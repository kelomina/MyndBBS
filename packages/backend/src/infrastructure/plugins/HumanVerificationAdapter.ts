import { prisma } from '../../db'
import { currentVerificationBinding } from '../../middleware/humanVerificationContext'
import {
  HumanVerificationService,
  VERIFICATION_HTML_BYTES,
  VERIFICATION_JSON_BYTES,
  isRecord,
  parseVerificationPolicy,
  verificationUnavailable,
  type VerificationRuntime,
  type VerificationSnapshot,
} from '../../application/system/HumanVerificationService'
import type { HumanVerificationPurpose } from '../../domain/shared/ports/IHumanVerification'
import { validatePluginManifest, ID } from './PluginManifest'
import { RedisVerificationStore } from './RedisVerificationStore'

/** Reads a bounded response before parsing. No browser request headers enter this client. */
async function boundedJson(response: Response, limit: number): Promise<unknown> {
  if (!response.ok || !response.body) throw verificationUnavailable()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > limit) {
        await reader.cancel()
        throw verificationUnavailable()
      }
      chunks.push(value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch {
    throw verificationUnavailable()
  } finally {
    reader.releaseLock()
  }
}
export class HttpHumanVerificationRuntime implements VerificationRuntime {
  get providerId(): string {
    return process.env.HUMAN_VERIFICATION_PLUGIN_ID || 'human-verification'
  }
  private async request(method: 'GET' | 'POST', body?: Record<string, unknown>): Promise<unknown> {
    const token = process.env.PLUGIN_CONTROL_TOKEN
    const base = process.env.PLUGIN_CONTROL_URL
    if (!ID.test(this.providerId) || !token || token.length < 32 || !base || !process.env.REDIS_URL)
      throw verificationUnavailable()
    try {
      const response = await fetch(
        base.replace(/\/+$/, '') + '/v1/plugins/' + this.providerId + '/human-verification',
        {
          method,
          headers: { 'x-plugin-control-token': token, 'content-type': 'application/json' },
          ...(body ? { body: JSON.stringify(body) } : {}),
          redirect: 'error',
          signal: AbortSignal.timeout(5000),
        },
      )
      return await boundedJson(
        response,
        body?.operation === 'ui'
          ? VERIFICATION_HTML_BYTES * 2 + VERIFICATION_JSON_BYTES
          : VERIFICATION_JSON_BYTES * 2,
      )
    } catch {
      throw verificationUnavailable()
    }
  }
  async inspect(): Promise<VerificationSnapshot> {
    const info = await this.request('GET')
    if (
      !isRecord(info) ||
      info.providerId !== this.providerId ||
      info.healthy !== true ||
      typeof info.version !== 'string' ||
      typeof info.generation !== 'string' ||
      !info.generation ||
      typeof info.artifactSha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(info.artifactSha256)
    )
      throw verificationUnavailable()
    validatePluginManifest(info.manifest)
    if (
      info.manifest.id !== this.providerId ||
      info.manifest.version !== info.version ||
      info.manifest.capabilities.humanVerification?.apiVersion !== 1
    )
      throw verificationUnavailable()
    const plugin = await prisma.plugin.findUnique({
      where: { pluginId: this.providerId },
      include: { releases: true },
    })
    const release = plugin?.releases.find(
      (r) =>
        r.version === info.version &&
        r.state === 'ACTIVE' &&
        r.approvedAt !== null &&
        r.artifactSha256 === info.artifactSha256,
    )
    if (
      !plugin ||
      plugin.desiredState !== 'ACTIVE' ||
      !['ACTIVE', 'ROLLED_BACK'].includes(plugin.runtimeState) ||
      plugin.currentVersion !== info.version ||
      !release
    )
      throw verificationUnavailable()
    // Use this generation's applied policy, not a saved-but-not-reloaded DB config.
    // Supervisor exposes only neutral non-secret fields, never the full runtime config.
    const policy = parseVerificationPolicy(info.policy)
    return {
      providerId: this.providerId,
      version: info.version,
      generation: info.generation,
      artifactSha256: info.artifactSha256,
      policy,
    }
  }
  async call(
    snapshot: VerificationSnapshot,
    operation: 'issue' | 'verify' | 'ui',
    purpose: HumanVerificationPurpose | undefined,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    const envelope = await this.request('POST', {
      operation,
      expectedGeneration: snapshot.generation,
      ...(purpose ? { purpose } : {}),
      input,
    })
    if (
      !isRecord(envelope) ||
      !isRecord(envelope.snapshot) ||
      !['providerId', 'version', 'artifactSha256', 'generation'].every(
        (k) =>
          envelope.snapshot &&
          (envelope.snapshot as Record<string, unknown>)[k] ===
            snapshot[k as keyof VerificationSnapshot],
      )
    )
      throw verificationUnavailable()
    if (
      !isRecord(envelope.result) ||
      (operation !== 'ui' &&
        Buffer.byteLength(JSON.stringify(envelope.result), 'utf8') > VERIFICATION_JSON_BYTES)
    )
      throw verificationUnavailable()
    return envelope.result
  }
}
export const humanVerificationService = new HumanVerificationService(
  new HttpHumanVerificationRuntime(),
  new RedisVerificationStore(),
  currentVerificationBinding,
)

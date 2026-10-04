import type { BackendPluginManifest, PluginEventEnvelope } from './PluginContracts'
import { validatePluginManifest } from './PluginManifest'

export type StagePluginArtifactInput = {
  fileName: string
  archive: Buffer
  signature: Buffer
  requestedBy: string
}

export type StagedPluginArtifact = {
  pluginId: string
  version: string
  manifest: BackendPluginManifest
  artifactSha256: string
  artifactPath?: string
}

export type PluginRuntimeSnapshot = {
  pluginId: string
  version?: string
  state: string
  healthy: boolean
  lastError?: string
}

export interface PluginRuntimePort {
  activate(
    pluginId: string,
    version: string,
    config?: Record<string, unknown>,
    artifactSha256?: string,
  ): Promise<PluginRuntimeSnapshot>
  deactivate(pluginId: string): Promise<PluginRuntimeSnapshot>
  reload(pluginId: string, config?: Record<string, unknown>): Promise<PluginRuntimeSnapshot>
  rollback(
    pluginId: string,
    version: string,
    config?: Record<string, unknown>,
    artifactSha256?: string,
  ): Promise<PluginRuntimeSnapshot>
  health(pluginId: string): Promise<PluginRuntimeSnapshot>
  deliverEvent(pluginId: string, event: PluginEventEnvelope): Promise<void>
}

export interface PluginControlPort extends PluginRuntimePort {
  stageArtifact(input: StagePluginArtifactInput): Promise<StagedPluginArtifact>
  approve(pluginId: string, version: string, artifactSha256: string): Promise<void>
  remove(pluginId: string): Promise<PluginRuntimeSnapshot>
}

function controlUrl(): string {
  const value = process.env.PLUGIN_CONTROL_URL
  if (!value) throw new Error('ERR_PLUGIN_CONTROL_UNAVAILABLE')
  return value.replace(/\/+$/, '')
}

function controlToken(): string {
  const value = process.env.PLUGIN_CONTROL_TOKEN
  if (!value) throw new Error('ERR_PLUGIN_CONTROL_TOKEN_MISSING')
  return value
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.text()
  let parsed: unknown = null
  try {
    parsed = body ? (JSON.parse(body) as unknown) : null
  } catch {
    parsed = null
  }
  if (!response.ok) {
    const code =
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { error?: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : 'ERR_PLUGIN_CONTROL_FAILED'
    throw new Error(code)
  }
  return parsed as T
}

export class HttpPluginControlClient implements PluginControlPort {
  private async request<T>(path: string, init: RequestInit, timeout = 10000): Promise<T> {
    const headers = new Headers(init.headers)
    headers.set('content-type', 'application/json')
    headers.set('x-plugin-control-token', controlToken())
    try {
      const response = await fetch(`${controlUrl()}${path}`, {
        ...init,
        headers,
        signal: AbortSignal.timeout(timeout),
      })
      return await parseResponse<T>(response)
    } catch (error) {
      throw new Error(
        error instanceof Error && /^ERR_[A-Z0-9_]+$/.test(error.message)
          ? error.message
          : 'ERR_PLUGIN_CONTROL_FAILED',
      )
    }
  }

  async stageArtifact(input: StagePluginArtifactInput): Promise<StagedPluginArtifact> {
    return this.request<StagedPluginArtifact>('/v1/plugins/stage', {
      method: 'POST',
      body: JSON.stringify({
        fileName: input.fileName,
        archiveBase64: input.archive.toString('base64'),
        signatureBase64: input.signature.toString('base64'),
        requestedBy: input.requestedBy,
      }),
    })
  }

  async approve(pluginId: string, version: string, artifactSha256: string): Promise<void> {
    await this.request(`/v1/plugins/${encodeURIComponent(pluginId)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ version, artifactSha256 }),
    })
  }

  async remove(pluginId: string): Promise<PluginRuntimeSnapshot> {
    return this.request(`/v1/plugins/${encodeURIComponent(pluginId)}/remove`, {
      method: 'POST',
      body: '{}',
    })
  }

  async activate(
    pluginId: string,
    version: string,
    config: Record<string, unknown> = {},
    artifactSha256?: string,
  ): Promise<PluginRuntimeSnapshot> {
    return this.request<PluginRuntimeSnapshot>(
      `/v1/plugins/${encodeURIComponent(pluginId)}/activate`,
      { method: 'POST', body: JSON.stringify({ version, config, artifactSha256 }) },
      60000,
    )
  }

  async deactivate(pluginId: string): Promise<PluginRuntimeSnapshot> {
    return this.request<PluginRuntimeSnapshot>(
      `/v1/plugins/${encodeURIComponent(pluginId)}/deactivate`,
      { method: 'POST', body: '{}' },
    )
  }

  async reload(
    pluginId: string,
    config: Record<string, unknown> = {},
  ): Promise<PluginRuntimeSnapshot> {
    return this.request<PluginRuntimeSnapshot>(
      `/v1/plugins/${encodeURIComponent(pluginId)}/reload`,
      { method: 'POST', body: JSON.stringify({ config }) },
      60000,
    )
  }

  async rollback(
    pluginId: string,
    version: string,
    config: Record<string, unknown> = {},
    artifactSha256?: string,
  ): Promise<PluginRuntimeSnapshot> {
    return this.request<PluginRuntimeSnapshot>(
      `/v1/plugins/${encodeURIComponent(pluginId)}/rollback`,
      { method: 'POST', body: JSON.stringify({ version, config, artifactSha256 }) },
      60000,
    )
  }

  async health(pluginId: string): Promise<PluginRuntimeSnapshot> {
    return this.request<PluginRuntimeSnapshot>(
      `/v1/plugins/${encodeURIComponent(pluginId)}/health`,
      { method: 'GET' },
    )
  }

  async deliverEvent(pluginId: string, event: PluginEventEnvelope): Promise<void> {
    await this.request(`/v1/plugins/${encodeURIComponent(pluginId)}/events`, {
      method: 'POST',
      body: JSON.stringify(event),
    })
  }
}

export class FakePluginControlPort implements PluginControlPort {
  async approve(_pluginId: string, _version: string, _artifactSha256: string): Promise<void> {}
  async remove(pluginId: string): Promise<PluginRuntimeSnapshot> {
    this.states.delete(pluginId)
    return { pluginId, state: 'DELETED', healthy: false }
  }
  public readonly staged: StagedPluginArtifact[] = []
  public readonly deliveredEvents: Array<{ pluginId: string; event: PluginEventEnvelope }> = []
  public readonly states = new Map<string, PluginRuntimeSnapshot>()

  async stageArtifact(input: StagePluginArtifactInput): Promise<StagedPluginArtifact> {
    const manifest = JSON.parse(input.archive.toString('utf8')) as unknown
    validatePluginManifest(manifest)
    const result: StagedPluginArtifact = {
      pluginId: manifest.id,
      version: manifest.version,
      manifest,
      artifactSha256: '0'.repeat(64),
    }
    this.staged.push(result)
    return result
  }
  async activate(pluginId: string, version: string): Promise<PluginRuntimeSnapshot> {
    return this.set(pluginId, { pluginId, version, state: 'ACTIVE', healthy: true })
  }
  async deactivate(pluginId: string): Promise<PluginRuntimeSnapshot> {
    return this.set(pluginId, { pluginId, state: 'DISABLED', healthy: false })
  }
  async reload(pluginId: string): Promise<PluginRuntimeSnapshot> {
    return this.set(pluginId, {
      ...this.states.get(pluginId),
      pluginId,
      state: 'ACTIVE',
      healthy: true,
    })
  }
  async rollback(pluginId: string, version: string): Promise<PluginRuntimeSnapshot> {
    return this.set(pluginId, { pluginId, version, state: 'ROLLED_BACK', healthy: true })
  }
  async health(pluginId: string): Promise<PluginRuntimeSnapshot> {
    return this.states.get(pluginId) ?? { pluginId, state: 'UNKNOWN', healthy: false }
  }
  async deliverEvent(pluginId: string, event: PluginEventEnvelope): Promise<void> {
    this.deliveredEvents.push({ pluginId, event })
  }
  private set(pluginId: string, snapshot: PluginRuntimeSnapshot): PluginRuntimeSnapshot {
    this.states.set(pluginId, snapshot)
    return snapshot
  }
}

export function pluginControlClient(): PluginControlPort {
  return new HttpPluginControlClient()
}

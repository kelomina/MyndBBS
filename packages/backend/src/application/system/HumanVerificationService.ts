import { randomBytes } from 'node:crypto'
import {
  HUMAN_VERIFICATION_PURPOSES,
  type HumanVerificationPurpose,
  type IHumanVerification,
  type VerificationAssurance,
} from '../../domain/shared/ports/IHumanVerification'

export const VERIFICATION_JSON_BYTES = 32 * 1024
export const VERIFICATION_HTML_BYTES = 256 * 1024
export const VERIFICATION_HANDLE = /^[A-Za-z0-9_-]{43}$/
export const BUSINESS_PURPOSES = ['registration', 'post', 'comment', 'friendRequest'] as const
export type VerificationPolicy = {
  enabled: boolean
  surfaces: Record<(typeof BUSINESS_PURPOSES)[number], boolean>
}
export type VerificationSnapshot = {
  providerId: string
  version: string
  artifactSha256: string
  generation: string
  policy: VerificationPolicy
}
export interface VerificationRuntime {
  readonly providerId: string
  inspect(): Promise<VerificationSnapshot>
  call(
    snapshot: VerificationSnapshot,
    operation: 'issue' | 'verify' | 'ui',
    purpose: HumanVerificationPurpose | undefined,
    input: Record<string, unknown>,
  ): Promise<unknown>
}
export type VerificationRecord = Record<string, unknown> & {
  providerId: string
  version: string
  artifactSha256: string
  generation: string
  purpose: HumanVerificationPurpose
  binding: string
  epoch: string
  deadline: number
}
export interface VerificationStore {
  put(
    kind: 'challenge' | 'proof',
    handle: string,
    record: VerificationRecord,
    ttlSec: number,
  ): Promise<void>
  take(
    kind: 'challenge' | 'proof',
    handle: string,
    expected: Record<string, string>,
    now: number,
  ): Promise<VerificationRecord | null>
}
export function verificationUnavailable(): Error {
  return new Error('ERR_HUMAN_VERIFICATION_UNAVAILABLE')
}
export function verificationInvalid(): Error {
  return new Error('ERR_HUMAN_VERIFICATION_INVALID')
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
export function assertVerificationJson(value: unknown, depth = 0): void {
  if (depth > 12) throw verificationInvalid()
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number' && Number.isFinite(value)) return
  if (Array.isArray(value)) {
    for (const child of value) assertVerificationJson(child, depth + 1)
    return
  }
  if (!isRecord(value)) throw verificationInvalid()
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw verificationInvalid()
    assertVerificationJson(child, depth + 1)
  }
}
function checkObject(value: unknown): asserts value is Record<string, unknown> {
  if (
    !isRecord(value) ||
    Buffer.byteLength(JSON.stringify(value), 'utf8') > VERIFICATION_JSON_BYTES
  )
    throw verificationInvalid()
  assertVerificationJson(value)
}
export function defaultVerificationPolicy(): VerificationPolicy {
  return {
    enabled: true,
    surfaces: { registration: true, post: true, comment: true, friendRequest: true },
  }
}
export function parseVerificationPolicy(config: unknown): VerificationPolicy {
  if (!isRecord(config)) throw verificationUnavailable()
  const policy = defaultVerificationPolicy()
  if (config.enabled !== undefined) {
    if (typeof config.enabled !== 'boolean') throw verificationUnavailable()
    policy.enabled = config.enabled
  }
  if (config.surfaces !== undefined) {
    if (
      !isRecord(config.surfaces) ||
      Object.keys(config.surfaces).some(
        (k) => !BUSINESS_PURPOSES.includes(k as (typeof BUSINESS_PURPOSES)[number]),
      )
    )
      throw verificationUnavailable()
    for (const purpose of BUSINESS_PURPOSES) {
      if (config.surfaces[purpose] === undefined) continue
      if (typeof config.surfaces[purpose] !== 'boolean') throw verificationUnavailable()
      policy.surfaces[purpose] = config.surfaces[purpose]
    }
  }
  return policy
}
function snapshotFields(s: VerificationSnapshot): Record<string, string> {
  return {
    providerId: s.providerId,
    version: s.version,
    artifactSha256: s.artifactSha256,
    generation: s.generation,
  }
}
function matches(record: VerificationRecord, s: VerificationSnapshot): boolean {
  return Object.entries(snapshotFields(s)).every(([k, v]) => record[k] === v)
}
/** Orchestrates capability calls and one-shot authorization, never solves a challenge. */
export class HumanVerificationService implements IHumanVerification {
  private inFlight = 0
  constructor(
    private readonly runtime: VerificationRuntime,
    private readonly store: VerificationStore,
    private readonly getBinding: () => string | undefined,
    private readonly getEpoch: () => string = () =>
      process.env.HUMAN_VERIFICATION_PROOF_EPOCH || 'v1',
    private readonly now: () => number = Date.now,
  ) {}
  private binding(): string {
    const value = this.getBinding()
    if (!value) throw verificationInvalid()
    return value
  }
  private async bounded<T>(operation: () => Promise<T>): Promise<T> {
    if (this.inFlight >= 16) throw verificationUnavailable()
    this.inFlight++
    try {
      return await operation()
    } finally {
      this.inFlight--
    }
  }
  async requirements() {
    try {
      return await this.bounded(async () => {
        const s = await this.runtime.inspect()
        return { ...s.policy, available: true, providerId: s.providerId }
      })
    } catch {
      return {
        ...defaultVerificationPolicy(),
        available: false,
        providerId: this.runtime.providerId,
      }
    }
  }
  async requires(purpose: HumanVerificationPurpose): Promise<boolean> {
    if (purpose === 'rateLimitUnlock') return true
    return this.bounded(async () => {
      const s = await this.runtime.inspect()
      return s.policy.enabled && s.policy.surfaces[purpose]
    })
  }
  async issue(purpose: HumanVerificationPurpose) {
    if (!(HUMAN_VERIFICATION_PURPOSES as readonly string[]).includes(purpose))
      throw verificationInvalid()
    const binding = this.binding()
    return this.bounded(async () => {
      const snapshot = await this.runtime.inspect()
      const issued = await this.runtime.call(snapshot, 'issue', purpose, {})
      checkObject(issued)
      if (
        typeof issued.challengeId !== 'string' ||
        !issued.challengeId ||
        issued.challengeId.length > 128 ||
        !isRecord(issued.challenge) ||
        !Number.isInteger(issued.expiresInSec) ||
        Number(issued.expiresInSec) < 1 ||
        Number(issued.expiresInSec) > 300
      )
        throw verificationUnavailable()
      checkObject(issued.challenge)
      const expiresInSec = Number(issued.expiresInSec)
      const challengeId = randomBytes(32).toString('base64url')
      await this.store.put(
        'challenge',
        challengeId,
        {
          ...snapshotFields(snapshot),
          providerId: snapshot.providerId,
          version: snapshot.version,
          artifactSha256: snapshot.artifactSha256,
          generation: snapshot.generation,
          purpose,
          binding,
          epoch: this.getEpoch(),
          deadline: this.now() + expiresInSec * 1000,
          remoteChallengeId: issued.challengeId,
        },
        expiresInSec,
      )
      return { challengeId, challenge: issued.challenge, expiresInSec }
    })
  }
  async verify(challengeId: string, solution: unknown) {
    if (!VERIFICATION_HANDLE.test(challengeId)) throw verificationInvalid()
    checkObject(solution)
    const binding = this.binding()
    return this.bounded(async () => {
      // Compare binding before deleting. Accepted attempts are burned even on timeout/error.
      const record = await this.store.take(
        'challenge',
        challengeId,
        { binding, epoch: this.getEpoch() },
        this.now(),
      )
      if (!record || typeof record.remoteChallengeId !== 'string') throw verificationInvalid()
      const snapshot = await this.runtime.inspect()
      if (!matches(record, snapshot)) throw verificationInvalid()
      const verdict = await this.runtime.call(snapshot, 'verify', record.purpose, {
        challengeId: record.remoteChallengeId,
        solution,
      })
      checkObject(verdict)
      if (
        verdict.verified !== true ||
        !['low', 'normal', 'strict'].includes(String(verdict.assurance))
      )
        throw verificationInvalid()
      const current = await this.runtime.inspect()
      if (!matches(record, current) || record.deadline <= this.now()) throw verificationInvalid()
      const verificationToken = randomBytes(32).toString('base64url')
      const expiresInSec = 120
      await this.store.put(
        'proof',
        verificationToken,
        { ...record, deadline: this.now() + expiresInSec * 1000, assurance: verdict.assurance },
        expiresInSec,
      )
      return { verificationToken, expiresInSec }
    })
  }
  private async consume(
    token: string,
    purpose: HumanVerificationPurpose,
  ): Promise<VerificationRecord | null> {
    if (!VERIFICATION_HANDLE.test(token)) return null
    const binding = this.binding()
    return this.bounded(async () => {
      const snapshot = await this.runtime.inspect()
      return this.store.take(
        'proof',
        token,
        { ...snapshotFields(snapshot), purpose, binding, epoch: this.getEpoch() },
        this.now(),
      )
    })
  }
  async consumeProof(token: string, purpose: HumanVerificationPurpose): Promise<boolean> {
    return (await this.consume(token, purpose)) !== null
  }
  async consumeUnlockProof(token: string): Promise<VerificationAssurance> {
    const proof = await this.consume(token, 'rateLimitUnlock')
    if (!proof || !['low', 'normal', 'strict'].includes(String(proof.assurance)))
      throw verificationInvalid()
    return proof.assurance as VerificationAssurance
  }
  async ui(): Promise<string> {
    return this.bounded(async () => {
      const snapshot = await this.runtime.inspect()
      const result = await this.runtime.call(snapshot, 'ui', undefined, {})
      if (
        !isRecord(result) ||
        typeof result.html !== 'string' ||
        Buffer.byteLength(result.html, 'utf8') > VERIFICATION_HTML_BYTES
      )
        throw verificationUnavailable()
      return result.html
    })
  }
}

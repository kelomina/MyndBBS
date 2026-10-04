export type VerificationPurpose =
  | 'registration'
  | 'post'
  | 'comment'
  | 'friendRequest'
  | 'rateLimitUnlock'
export type VerificationSurface = Exclude<VerificationPurpose, 'rateLimitUnlock'>
export interface VerificationRequirements {
  enabled: boolean
  surfaces: Record<VerificationSurface, boolean>
  available: boolean
  providerId: string
}
export interface VerificationChallenge {
  challengeId: string
  challenge: Record<string, unknown>
  expiresInSec: number
}
export interface VerificationProof {
  verificationToken: string
  expiresInSec: number
}
export const VERIFICATION_BASE = '/api/human-verification'
export const MAX_JSON_BYTES = 32 * 1024
export class VerificationError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 0,
    public readonly retryAfterSec = 0,
  ) {
    super(code)
  }
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}
export function validJson(value: unknown, depth = 0): boolean {
  if (depth > 12) return false
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every((v) => validJson(v, depth + 1))
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([k, v]) => !['__proto__', 'prototype', 'constructor'].includes(k) && validJson(v, depth + 1),
    )
  )
}
export async function verificationRequest(
  endpoint: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const json = body === undefined ? undefined : JSON.stringify(body)
  if (json && (!validJson(body) || new TextEncoder().encode(json).length > MAX_JSON_BYTES))
    throw new VerificationError('ERR_HUMAN_VERIFICATION_INVALID', 400)
  const response = await fetch(VERIFICATION_BASE + endpoint, {
    method: json === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(5000)])
      : AbortSignal.timeout(5000),
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    ...(json === undefined ? {} : { body: json }),
  })
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? ''))
    throw new VerificationError('ERR_HUMAN_VERIFICATION_UNAVAILABLE', 503)
  const reader = response.body?.getReader()
  if (!reader) throw new VerificationError('ERR_HUMAN_VERIFICATION_UNAVAILABLE', 503)
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > MAX_JSON_BYTES) throw new VerificationError('ERR_HUMAN_VERIFICATION_INVALID', 400)
      chunks.push(part.value)
    }
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const c of chunks) {
    bytes.set(c, offset)
    offset += c.length
  }
  let data: unknown
  try {
    data = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new VerificationError('ERR_HUMAN_VERIFICATION_UNAVAILABLE', 503)
  }
  if (!response.ok) {
    const retry = Number(response.headers.get('Retry-After'))
    throw new VerificationError(
      isRecord(data) && typeof data.error === 'string'
        ? data.error
        : 'ERR_HUMAN_VERIFICATION_UNAVAILABLE',
      response.status,
      Number.isFinite(retry) && retry > 0 ? Math.ceil(retry) : response.status === 429 ? 60 : 0,
    )
  }
  if (!validJson(data)) throw new VerificationError('ERR_HUMAN_VERIFICATION_INVALID', 400)
  return data
}
function validTtl(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 300
}
async function loadVerificationRequirements(): Promise<VerificationRequirements> {
  const data = await verificationRequest('/requirements')
  if (
    !isRecord(data) ||
    typeof data.enabled !== 'boolean' ||
    typeof data.available !== 'boolean' ||
    typeof data.providerId !== 'string' ||
    !isRecord(data.surfaces) ||
    !['registration', 'post', 'comment', 'friendRequest'].every(
      (k) => typeof (data.surfaces as Record<string, unknown>)[k] === 'boolean',
    )
  )
    throw new VerificationError('ERR_HUMAN_VERIFICATION_UNAVAILABLE', 503)
  return data as unknown as VerificationRequirements
}
export async function issueVerification(
  purpose: VerificationPurpose,
  signal: AbortSignal,
): Promise<VerificationChallenge> {
  const data = await verificationRequest('/challenge', { purpose }, signal)
  if (
    !isRecord(data) ||
    typeof data.challengeId !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(data.challengeId) ||
    !isRecord(data.challenge) ||
    !validTtl(data.expiresInSec)
  )
    throw new VerificationError('ERR_HUMAN_VERIFICATION_INVALID', 400)
  return data as unknown as VerificationChallenge
}
export async function verifyAnswer(
  challengeId: string,
  solution: Record<string, unknown>,
  signal: AbortSignal,
): Promise<VerificationProof> {
  const data = await verificationRequest('/verify', { challengeId, solution }, signal)
  if (
    !isRecord(data) ||
    typeof data.verificationToken !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(data.verificationToken) ||
    !validTtl(data.expiresInSec)
  )
    throw new VerificationError('ERR_HUMAN_VERIFICATION_INVALID', 400)
  return data as unknown as VerificationProof
}

let requirementsPending: Promise<VerificationRequirements> | null = null
export async function getVerificationRequirements(
  signal?: AbortSignal,
): Promise<VerificationRequirements> {
  if (!requirementsPending)
    requirementsPending = loadVerificationRequirements().finally(() => {
      requirementsPending = null
    })
  const result = await requirementsPending
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  return result
}

import { isRecord, validJson, MAX_JSON_BYTES } from './client'
export type VerificationMessage =
  | { type: 'answer'; nonce: string; challengeId: string; solution: Record<string, unknown> }
  | { type: 'resize'; nonce: string; challengeId: string; height: number }
  | { type: 'cancel'; nonce: string; challengeId: string }
  | {
      type: 'focus-boundary'
      nonce: string
      challengeId: string
      direction: 'forward' | 'backward'
    }
export function parseVerificationMessage(
  data: unknown,
  nonce: string,
  challengeId: string,
): VerificationMessage | null {
  if (
    !isRecord(data) ||
    data.nonce !== nonce ||
    data.challengeId !== challengeId ||
    !validJson(data)
  )
    return null
  const fields: Record<string, string[]> = {
    answer: ['solution'],
    resize: ['height'],
    cancel: [],
    'focus-boundary': ['direction'],
  }
  if (typeof data.type !== 'string' || !Object.hasOwn(fields, data.type)) return null
  const allowedFields = fields[data.type]
  if (
    Object.keys(data).some((k) => !['type', 'nonce', 'challengeId', ...allowedFields].includes(k))
  )
    return null
  if (new TextEncoder().encode(JSON.stringify(data)).length > MAX_JSON_BYTES) return null
  if (data.type === 'answer' && !isRecord(data.solution)) return null
  if (data.type === 'resize' && (typeof data.height !== 'number' || !Number.isFinite(data.height)))
    return null
  if (data.type === 'focus-boundary' && !['forward', 'backward'].includes(String(data.direction)))
    return null
  return data as VerificationMessage
}
export function isVerificationReady(data: unknown, nonce: string): boolean {
  return (
    isRecord(data) &&
    Object.keys(data).length === 2 &&
    data.type === 'myndbbs:verification:ready' &&
    data.nonce === nonce
  )
}

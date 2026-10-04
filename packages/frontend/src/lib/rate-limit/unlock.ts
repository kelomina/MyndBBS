'use client'
import { verificationRequest, isRecord, VerificationError } from '../human-verification/client'
export interface UnlockSuccess {
  unlockToken: string
  exemptMinutes: number
  expiresAt: string
}
/** Proof is consumed once by core; the iframe never receives the exemption token. */
export async function postUnlock(
  payload: { verificationToken: string },
  signal?: AbortSignal,
): Promise<UnlockSuccess> {
  const data = await verificationRequest('/unlock', payload, signal)
  if (
    !isRecord(data) ||
    typeof data.unlockToken !== 'string' ||
    !data.unlockToken ||
    typeof data.exemptMinutes !== 'number' ||
    !Number.isFinite(data.exemptMinutes) ||
    data.exemptMinutes <= 0 ||
    typeof data.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(data.expiresAt))
  )
    throw new VerificationError('ERR_HUMAN_VERIFICATION_INVALID', 400)
  return data as unknown as UnlockSuccess
}

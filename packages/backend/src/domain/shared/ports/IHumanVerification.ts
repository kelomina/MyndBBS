/** Core authorization port; providers own challenge algorithms and presentation. */
export const HUMAN_VERIFICATION_PURPOSES = [
  'registration',
  'post',
  'comment',
  'friendRequest',
  'rateLimitUnlock',
] as const
export type HumanVerificationPurpose = (typeof HUMAN_VERIFICATION_PURPOSES)[number]
export type VerificationAssurance = 'low' | 'normal' | 'strict'
export interface IHumanVerification {
  requires(purpose: HumanVerificationPurpose): Promise<boolean>
  consumeProof(token: string, purpose: HumanVerificationPurpose): Promise<boolean>
}

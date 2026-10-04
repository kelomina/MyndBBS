import type { Request, Response } from 'express'
import {
  HUMAN_VERIFICATION_PURPOSES,
  type HumanVerificationPurpose,
  type VerificationAssurance,
} from '../domain/shared/ports/IHumanVerification'
import {
  HumanVerificationService,
  isRecord,
  verificationInvalid,
} from '../application/system/HumanVerificationService'
import {
  ensureVerificationBinding,
  verificationClientIp,
} from '../middleware/humanVerificationContext'

export const HUMAN_VERIFICATION_UI_CSP =
  "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"
export interface VerificationUnlockPort {
  grant(
    ip: string,
    assurance: VerificationAssurance,
  ): Promise<{ unlockToken: string; exemptMinutes: number; expiresAt: string }>
}
function body(req: Request, keys: string[]): Record<string, unknown> {
  if (
    !req.is('application/json') ||
    !isRecord(req.body) ||
    Object.keys(req.body).some((k) => !keys.includes(k))
  )
    throw verificationInvalid()
  return req.body as Record<string, unknown>
}
function failure(res: Response, error: unknown): void {
  const invalid = error instanceof Error && error.message === 'ERR_HUMAN_VERIFICATION_INVALID'
  res
    .status(invalid ? 400 : 503)
    .json({
      error: invalid ? 'ERR_HUMAN_VERIFICATION_INVALID' : 'ERR_HUMAN_VERIFICATION_UNAVAILABLE',
    })
}
/** Request/response adapter only. It never evaluates a slider, geometry or PoW answer. */
export function createHumanVerificationHandlers(
  service: HumanVerificationService,
  unlock: VerificationUnlockPort,
) {
  return {
    requirements: async (req: Request, res: Response): Promise<void> => {
      try {
        ensureVerificationBinding(req, res)
        res.json(await service.requirements())
      } catch (error) {
        failure(res, error)
      }
    },
    challenge: async (req: Request, res: Response): Promise<void> => {
      try {
        const input = body(req, ['purpose'])
        if (
          typeof input.purpose !== 'string' ||
          !(HUMAN_VERIFICATION_PURPOSES as readonly string[]).includes(input.purpose)
        )
          throw verificationInvalid()
        ensureVerificationBinding(req, res)
        res.json(await service.issue(input.purpose as HumanVerificationPurpose))
      } catch (error) {
        failure(res, error)
      }
    },
    verify: async (req: Request, res: Response): Promise<void> => {
      try {
        const input = body(req, ['challengeId', 'solution'])
        if (typeof input.challengeId !== 'string') throw verificationInvalid()
        res.json(await service.verify(input.challengeId, input.solution))
      } catch (error) {
        failure(res, error)
      }
    },
    ui: async (_req: Request, res: Response): Promise<void> => {
      try {
        const html = await service.ui()
        res.removeHeader('set-cookie')
        res.removeHeader('x-frame-options')
        res.setHeader('content-security-policy', HUMAN_VERIFICATION_UI_CSP)
        res.setHeader('x-content-type-options', 'nosniff')
        res.type('html').send(html)
      } catch (error) {
        failure(res, error)
      }
    },
    unlock: async (req: Request, res: Response): Promise<void> => {
      try {
        const input = body(req, ['verificationToken'])
        if (typeof input.verificationToken !== 'string') throw verificationInvalid()
        const assurance = await service.consumeUnlockProof(input.verificationToken)
        // grant() must persist the exemption before returning any successful token.
        res.json(await unlock.grant(verificationClientIp(req), assurance))
      } catch (error) {
        failure(res, error)
      }
    },
  }
}

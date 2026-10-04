import { Router } from 'express'
import { rateLimit, ipKeyGenerator } from 'express-rate-limit'
import { humanVerificationService } from '../infrastructure/plugins/HumanVerificationAdapter'
import { rateLimitProtectionService } from '../registry'
import {
  createHumanVerificationHandlers,
  type VerificationUnlockPort,
} from '../controllers/humanVerification'
import type { HumanVerificationService } from '../application/system/HumanVerificationService'
import { verificationClientIp } from '../middleware/humanVerificationContext'
import { rateLimitExemptionStore } from '../infrastructure/services/RateLimitExemptionStore'
import { signUnlockToken } from '../lib/unlockToken'

export function createHumanVerificationRouter(
  service: HumanVerificationService,
  unlock: VerificationUnlockPort,
): Router {
  const router: Router = Router()
  const handlers = createHumanVerificationHandlers(service, unlock)
  router.use((_req, res, next) => {
    res.setHeader('cache-control', 'no-store')
    next()
  })
  const attempts = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    // A fresh cookie cannot reset the hard per-IP budget. No test reset header.
    keyGenerator: (req) => ipKeyGenerator(verificationClientIp(req)),
    message: { error: 'ERR_HUMAN_VERIFICATION_RATE_LIMITED' },
  })
  const reads = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(verificationClientIp(req)),
    message: { error: 'ERR_HUMAN_VERIFICATION_RATE_LIMITED' },
  })
  router.get('/requirements', reads, handlers.requirements)
  router.get('/ui', reads, handlers.ui)
  router.post('/challenge', attempts, handlers.challenge)
  router.post('/verify', attempts, handlers.verify)
  router.post('/unlock', attempts, handlers.unlock)
  return router
}

export default createHumanVerificationRouter(humanVerificationService, {
  async grant(ip, assurance) {
    const policy = await rateLimitProtectionService.getPolicy()
    const signed = signUnlockToken({
      ip,
      exemptionMinutes: policy.exemptionMinutes,
      strength: assurance,
    })
    await rateLimitExemptionStore.saveStrict(ip, signed.jti, signed.exemptSeconds)
    return {
      unlockToken: signed.token,
      exemptMinutes: policy.exemptionMinutes,
      expiresAt: signed.expiresAt.toISOString(),
    }
  },
})

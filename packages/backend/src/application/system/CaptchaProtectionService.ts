import type { ISitePolicyRepository } from '../../domain/system/ISitePolicyRepository'
import {
  CAPTCHA_PROTECTION_KEY,
  cloneDefaultCaptchaProtectionPolicy,
  parseCaptchaProtectionPolicy,
  requiresCaptcha,
  type CaptchaProtectionPolicy,
  type CaptchaProtectionSurface,
} from '../../domain/system/CaptchaProtection'

const CACHE_TTL_MS = 60_000

export interface CaptchaProtectionServiceOptions {
  sitePolicyRepository: ISitePolicyRepository
}

export class CaptchaProtectionService {
  private cache: { policy: CaptchaProtectionPolicy; loadedAt: number } | null = null

  constructor(private readonly opts: CaptchaProtectionServiceOptions) {}

  public async getPolicy(): Promise<CaptchaProtectionPolicy> {
    if (this.cache && process.env.NODE_ENV !== 'test' && Date.now() - this.cache.loadedAt < CACHE_TTL_MS) {
      return clonePolicy(this.cache.policy)
    }
    const raw = await this.opts.sitePolicyRepository.get(CAPTCHA_PROTECTION_KEY)
    const policy = raw === null ? cloneDefaultCaptchaProtectionPolicy() : parseCaptchaProtectionPolicy(raw)
    this.cache = { policy, loadedAt: Date.now() }
    return clonePolicy(policy)
  }

  public async requires(surface: CaptchaProtectionSurface): Promise<boolean> {
    return requiresCaptcha(await this.getPolicy(), surface)
  }

  public async replacePolicy(next: CaptchaProtectionPolicy): Promise<CaptchaProtectionPolicy> {
    await this.opts.sitePolicyRepository.set(CAPTCHA_PROTECTION_KEY, next)
    this.cache = { policy: clonePolicy(next), loadedAt: Date.now() }
    return clonePolicy(next)
  }

  public clearCache(): void {
    this.cache = null
  }
}

function clonePolicy(policy: CaptchaProtectionPolicy): CaptchaProtectionPolicy {
  return { enabled: policy.enabled, surfaces: { ...policy.surfaces } }
}

import {
  cloneDefaultCaptchaProtectionPolicy,
  parseCaptchaProtectionPolicy,
  requiresCaptcha,
} from '../src/domain/system/CaptchaProtection'
import { CaptchaProtectionService } from '../src/application/system/CaptchaProtectionService'

describe('CaptchaProtection', () => {
  it('defaults every business surface to enabled when stored data is missing or malformed', () => {
    expect(parseCaptchaProtectionPolicy(null)).toEqual(cloneDefaultCaptchaProtectionPolicy())
    expect(parseCaptchaProtectionPolicy({ enabled: false })).toEqual(cloneDefaultCaptchaProtectionPolicy())
    expect(parseCaptchaProtectionPolicy({ enabled: false, surfaces: { post: false } })).toEqual(
      cloneDefaultCaptchaProtectionPolicy(),
    )
    expect(parseCaptchaProtectionPolicy({
      enabled: true,
      surfaces: {
        registration: true,
        post: true,
        comment: true,
        friendRequest: true,
      },
      unexpected: true,
    })).toEqual(cloneDefaultCaptchaProtectionPolicy())
  })

  it('uses the global switch and per-surface switches', () => {
    const policy = parseCaptchaProtectionPolicy({
      enabled: true,
      surfaces: { registration: true, post: false, comment: true, friendRequest: false },
    })
    expect(requiresCaptcha(policy, 'registration')).toBe(true)
    expect(requiresCaptcha(policy, 'post')).toBe(false)
    expect(requiresCaptcha(policy, 'friendRequest')).toBe(false)
    expect(requiresCaptcha({ ...policy, enabled: false }, 'registration')).toBe(false)
  })

  it('persists a full replacement and refreshes the cache', async () => {
    let value: unknown = null
    const repository = {
      get: jest.fn(async () => value),
      set: jest.fn(async (_key: string, next: unknown) => {
        value = next
      }),
    }
    const service = new CaptchaProtectionService({ sitePolicyRepository: repository })
    const next = {
      enabled: true,
      surfaces: { registration: true, post: false, comment: true, friendRequest: false },
    }

    await expect(service.getPolicy()).resolves.toEqual(cloneDefaultCaptchaProtectionPolicy())
    await expect(service.replacePolicy(next)).resolves.toEqual(next)
    await expect(service.getPolicy()).resolves.toEqual(next)
    expect(repository.set).toHaveBeenCalledWith('captcha_protection', next)
  })
})

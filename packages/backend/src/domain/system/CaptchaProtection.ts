/**
 * 业务入口人机验证策略。
 * 读限流解锁和联邦题型使用各自独立的 SitePolicy，不在这里重复配置。
 */

export type CaptchaProtectionSurface = 'registration' | 'post' | 'comment' | 'friendRequest'

export interface CaptchaProtectionSurfaces {
  registration: boolean
  post: boolean
  comment: boolean
  friendRequest: boolean
}

export interface CaptchaProtectionPolicy {
  enabled: boolean
  surfaces: CaptchaProtectionSurfaces
}

export const CAPTCHA_PROTECTION_KEY = 'captcha_protection'

export const DEFAULT_CAPTCHA_PROTECTION_POLICY: CaptchaProtectionPolicy = {
  enabled: true,
  surfaces: {
    registration: true,
    post: true,
    comment: true,
    friendRequest: true,
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

const CAPTCHA_SURFACES = ['registration', 'post', 'comment', 'friendRequest'] as const

function isCompleteSurfaces(value: unknown): value is CaptchaProtectionSurfaces {
  if (!isRecord(value)) return false
  return CAPTCHA_SURFACES.every((surface) => typeof value[surface] === 'boolean') &&
    Object.keys(value).every((key) => CAPTCHA_SURFACES.includes(key as (typeof CAPTCHA_SURFACES)[number]))
}

function isCompletePolicy(value: unknown): value is CaptchaProtectionPolicy {
  if (!isRecord(value) || typeof value.enabled !== 'boolean' || !isCompleteSurfaces(value.surfaces)) {
    return false
  }
  return Object.keys(value).every((key) => key === 'enabled' || key === 'surfaces')
}

export function parseCaptchaProtectionPolicy(json: unknown): CaptchaProtectionPolicy {
  // A partially written policy must never turn protection off. Treat the whole
  // value as missing unless it is a complete, schema-shaped policy.
  if (!isCompletePolicy(json)) return cloneDefaultCaptchaProtectionPolicy()
  return {
    enabled: json.enabled,
    surfaces: { ...json.surfaces },
  }
}

export function cloneDefaultCaptchaProtectionPolicy(): CaptchaProtectionPolicy {
  return {
    enabled: DEFAULT_CAPTCHA_PROTECTION_POLICY.enabled,
    surfaces: { ...DEFAULT_CAPTCHA_PROTECTION_POLICY.surfaces },
  }
}

export function requiresCaptcha(
  policy: CaptchaProtectionPolicy,
  surface: CaptchaProtectionSurface,
): boolean {
  return policy.enabled && policy.surfaces[surface]
}

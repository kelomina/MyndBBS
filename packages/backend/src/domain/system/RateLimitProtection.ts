/**
 * 领域：读限流解锁配置（SitePolicy key = 'rate_limit_unlock'）
 *
 * 冻结契约：API-SPEC.yaml v1.0.2 + PRD.md v1.1.1
 * - 7 字段：enabled/publicReadMax/windowSec/captchaStrength/exemptionMinutes/exemptionScope/loginRelaxed
 * - G2 strict 无 coerce：parse 层仅缺字段补默认（读路径），不做类型归一/coerce/trim 归一，无 clamp
 * - PUT 写路径不补不归一：缺字段由 zod 层 400，本层不补
 */

export type CaptchaStrength = 'low' | 'normal' | 'strict'

export interface RateLimitProtectionPolicy {
  enabled: boolean
  publicReadMax: number
  windowSec: number
  captchaStrength: CaptchaStrength
  exemptionMinutes: number
  exemptionScope: 'ip'
  loginRelaxed: false
}

export const RATE_LIMIT_PROTECTION_KEY = 'rate_limit_unlock'

export const DEFAULT_RATE_LIMIT_PROTECTION_POLICY: RateLimitProtectionPolicy = {
  enabled: true,
  publicReadMax: 30,
  windowSec: 60,
  captchaStrength: 'low',
  exemptionMinutes: 15,
  exemptionScope: 'ip',
  loginRelaxed: false,
}

export const RATE_LIMIT_WINDOW_SEC_WHITELIST: readonly number[] = [10, 30, 60, 300, 600]

export function isCaptchaStrength(value: unknown): value is CaptchaStrength {
  return value === 'low' || value === 'normal' || value === 'strict'
}

/**
 * 读路径解析：仅缺字段补默认，不做 coerce/归一/clamp。
 * - 存储缺 key / null / 非对象 → 全默认
 * - 每个字段仅当类型+范围合法才采用，否则用默认（读路径容错；写路径由 zod 严格 400，不走此处补默认）
 * - G2 冻结：数字字符串如 "30" 不归一（读路径视为非法→默认；写路径 zod 直接 400）
 */
export function parseRateLimitProtectionPolicy(json: unknown): RateLimitProtectionPolicy {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    return { ...DEFAULT_RATE_LIMIT_PROTECTION_POLICY }
  }
  const raw = json as Record<string, unknown>

  const enabled =
    typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_RATE_LIMIT_PROTECTION_POLICY.enabled

  const publicReadMax =
    typeof raw.publicReadMax === 'number' &&
    Number.isInteger(raw.publicReadMax) &&
    raw.publicReadMax >= 10 &&
    raw.publicReadMax <= 1000
      ? raw.publicReadMax
      : DEFAULT_RATE_LIMIT_PROTECTION_POLICY.publicReadMax

  const windowSec =
    typeof raw.windowSec === 'number' &&
    Number.isInteger(raw.windowSec) &&
    (RATE_LIMIT_WINDOW_SEC_WHITELIST as readonly unknown[]).includes(raw.windowSec)
      ? (raw.windowSec as number)
      : DEFAULT_RATE_LIMIT_PROTECTION_POLICY.windowSec

  const captchaStrength = isCaptchaStrength(raw.captchaStrength)
    ? raw.captchaStrength
    : DEFAULT_RATE_LIMIT_PROTECTION_POLICY.captchaStrength

  const exemptionMinutes =
    typeof raw.exemptionMinutes === 'number' &&
    Number.isInteger(raw.exemptionMinutes) &&
    raw.exemptionMinutes >= 1 &&
    raw.exemptionMinutes <= 120
      ? raw.exemptionMinutes
      : DEFAULT_RATE_LIMIT_PROTECTION_POLICY.exemptionMinutes

  // v1 只读 ip / 恒 false：读路径非法→默认；写路径 zod 400
  const exemptionScope: 'ip' = raw.exemptionScope === 'ip' ? 'ip' : 'ip'
  const loginRelaxed: false = false

  return {
    enabled,
    publicReadMax,
    windowSec,
    captchaStrength,
    exemptionMinutes,
    exemptionScope,
    loginRelaxed,
  }
}

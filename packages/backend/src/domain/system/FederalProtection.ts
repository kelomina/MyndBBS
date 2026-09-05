/**
 * 领域：联邦验证管理配置（SitePolicy key = 'captcha_federal'）
 *
 * 冻结契约：API-SPEC-TAG-CAPTCHA-NOTIFY v1.0.1 + 演示批准增量（channel-general 02:00）
 * - 6 字段必填 + strictTimeoutSec 可选兼容（PUT 缺省默认 15，GET 回显恒含；传了仍按 5–60 校验）
 * - G2 strict 无 coerce：parse 层仅缺字段补默认（读路径），不做类型归一/coerce/trim 归一，无 clamp
 * - PUT 写路径不补不归一：除 strictTimeoutSec 可选缺省外，缺字段由 zod 层 400，本层不补
 */

export type FederalKind = 'slider' | 'geometry' | 'pow'

export interface FederalKinds {
  sliderEnabled: boolean
  geometryEnabled: boolean
  powEnabled: boolean
}

export interface FederalProtectionPolicy {
  enabled: boolean
  kinds: FederalKinds
  defaultKind: FederalKind
  powBits: number
  geometryLevel: number
  timeoutSec: number
  strictTimeoutSec: number
}

export const FEDERAL_PROTECTION_KEY = 'captcha_federal'

export const DEFAULT_FEDERAL_PROTECTION_POLICY: FederalProtectionPolicy = {
  enabled: true,
  kinds: { sliderEnabled: true, geometryEnabled: true, powEnabled: true },
  defaultKind: 'slider',
  powBits: 16,
  geometryLevel: 1,
  timeoutSec: 10,
  strictTimeoutSec: 15,
}

export function isFederalKind(value: unknown): value is FederalKind {
  return value === 'slider' || value === 'geometry' || value === 'pow'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * 读路径解析：仅缺字段/非法值补默认，不做 coerce/归一/clamp。
 * - 存储缺 key / null / 非对象 → 全默认
 * - 数字字符串如 "16" 视为非法 → 默认（读路径容错；写路径 zod 直接 400）
 */
export function parseFederalProtectionPolicy(json: unknown): FederalProtectionPolicy {
  if (!isRecord(json)) return structuredCloneDefault()
  const raw = json as Record<string, unknown>

  const enabled =
    typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_FEDERAL_PROTECTION_POLICY.enabled

  let kinds: FederalKinds = { ...DEFAULT_FEDERAL_PROTECTION_POLICY.kinds }
  if (isRecord(raw.kinds)) {
    const k = raw.kinds as Record<string, unknown>
    kinds = {
      sliderEnabled:
        typeof k.sliderEnabled === 'boolean'
          ? k.sliderEnabled
          : DEFAULT_FEDERAL_PROTECTION_POLICY.kinds.sliderEnabled,
      geometryEnabled:
        typeof k.geometryEnabled === 'boolean'
          ? k.geometryEnabled
          : DEFAULT_FEDERAL_PROTECTION_POLICY.kinds.geometryEnabled,
      powEnabled:
        typeof k.powEnabled === 'boolean'
          ? k.powEnabled
          : DEFAULT_FEDERAL_PROTECTION_POLICY.kinds.powEnabled,
    }
  }

  const defaultKind = isFederalKind(raw.defaultKind)
    ? raw.defaultKind
    : DEFAULT_FEDERAL_PROTECTION_POLICY.defaultKind

  const powBits =
    typeof raw.powBits === 'number' &&
    Number.isInteger(raw.powBits) &&
    raw.powBits >= 8 &&
    raw.powBits <= 24
      ? raw.powBits
      : DEFAULT_FEDERAL_PROTECTION_POLICY.powBits

  const geometryLevel =
    typeof raw.geometryLevel === 'number' &&
    Number.isInteger(raw.geometryLevel) &&
    raw.geometryLevel >= 1 &&
    raw.geometryLevel <= 3
      ? raw.geometryLevel
      : DEFAULT_FEDERAL_PROTECTION_POLICY.geometryLevel

  const timeoutSec =
    typeof raw.timeoutSec === 'number' &&
    Number.isInteger(raw.timeoutSec) &&
    raw.timeoutSec >= 5 &&
    raw.timeoutSec <= 60
      ? raw.timeoutSec
      : DEFAULT_FEDERAL_PROTECTION_POLICY.timeoutSec

  const strictTimeoutSec =
    typeof raw.strictTimeoutSec === 'number' &&
    Number.isInteger(raw.strictTimeoutSec) &&
    raw.strictTimeoutSec >= 5 &&
    raw.strictTimeoutSec <= 60
      ? raw.strictTimeoutSec
      : DEFAULT_FEDERAL_PROTECTION_POLICY.strictTimeoutSec

  return { enabled, kinds, defaultKind, powBits, geometryLevel, timeoutSec, strictTimeoutSec }
}

function structuredCloneDefault(): FederalProtectionPolicy {
  return {
    enabled: DEFAULT_FEDERAL_PROTECTION_POLICY.enabled,
    kinds: { ...DEFAULT_FEDERAL_PROTECTION_POLICY.kinds },
    defaultKind: DEFAULT_FEDERAL_PROTECTION_POLICY.defaultKind,
    powBits: DEFAULT_FEDERAL_PROTECTION_POLICY.powBits,
    geometryLevel: DEFAULT_FEDERAL_PROTECTION_POLICY.geometryLevel,
    timeoutSec: DEFAULT_FEDERAL_PROTECTION_POLICY.timeoutSec,
    strictTimeoutSec: DEFAULT_FEDERAL_PROTECTION_POLICY.strictTimeoutSec,
  }
}

/** 是否启用指定题型 */
export function isKindEnabled(policy: FederalProtectionPolicy, kind: FederalKind): boolean {
  if (kind === 'slider') return policy.kinds.sliderEnabled
  if (kind === 'geometry') return policy.kinds.geometryEnabled
  return policy.kinds.powEnabled
}

/**
 * 缺省签发题型（effectiveKind）：
 * defaultKind 若启用则用之，否则按 slider→geometry→pow 回落首个启用项；
 * 三开关全关时返回 null（管理 PUT 保证至少保 1，运行时兜底 400）。
 */
export function resolveEffectiveKind(policy: FederalProtectionPolicy): FederalKind | null {
  if (isKindEnabled(policy, policy.defaultKind)) return policy.defaultKind
  const priority: FederalKind[] = ['slider', 'geometry', 'pow']
  for (const kind of priority) {
    if (isKindEnabled(policy, kind)) return kind
  }
  return null
}

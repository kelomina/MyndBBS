import { randomInt } from 'crypto'
import {
  CAPTCHA_STRENGTH_PARAMS,
  STRICT_VARIANCE_THRESHOLDS,
  type CaptchaStrength,
} from './CaptchaChallenge'

/**
 * 联邦几何小时钟域规则（演示批准增量 channel-general 02:00 + 用户任务 1）：
 * - 一周 1560 微槽（字面值，130/数字），microSlot ∈ [0,1559] 整数
 * - 12 错序数字 perm[12]（0–11 排列），读数 = perm[round(micro/130) % 12]
 * - 默认档（low/normal）仅语义命中（读数 == targetHour）；严格档（strict）加中心偏差 ≤30 微槽
 * - 拖动行为服务端重算，不可信客户端结论：采样数/时长/瞬移/匀速直线启发式，疑似即失败
 * - RNG 禁 Math.random（perm/targetHour 均经 crypto.randomInt）
 */

export const GEOMETRY_MICRO_SLOTS = 1560
export const GEOMETRY_PER_DIGIT = 130
export const GEOMETRY_CENTER_DEVIATION_LIMIT = 30
export const GEOMETRY_PERM_SIZE = 12

/** 中心偏差上限（约 ±6.9°：360/1560*30） */
export const GEOMETRY_STRICT_CENTER_LIMIT = GEOMETRY_CENTER_DEVIATION_LIMIT

export interface BehaviorSample {
  t: number
  x: number
  y: number
}

export interface GeometryChallengeData {
  perm: number[]
  targetHour: number
  issuedAt: string
  geometryLevel: number
}

export function isValidMicroSlot(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < GEOMETRY_MICRO_SLOTS
  )
}

export function isValidPerm(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length !== GEOMETRY_PERM_SIZE) return false
  const seen = new Set<number>()
  for (const v of value) {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 11) return false
    seen.add(v)
  }
  return seen.size === GEOMETRY_PERM_SIZE
}

export function isValidTargetHour(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 11
}

/** 生成 0–11 随机排列（Fisher-Yates + crypto.randomInt，禁 Math.random） */
export function generatePerm(): number[] {
  const arr: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    const a = arr[i] as number
    const b = arr[j] as number
    arr[i] = b
    arr[j] = a
  }
  return arr
}

/** 生成目标小时（0–11，crypto.randomInt） */
export function generateTargetHour(): number {
  return randomInt(12)
}

/** 槽位索引 s = round(micro/130) % 12（micro 已校验 0–1559） */
export function slotIndexForMicro(microSlot: number): number {
  return Math.round(microSlot / GEOMETRY_PER_DIGIT) % GEOMETRY_PERM_SIZE
}

/** 读数 = perm[s]（perm 已校验 12 排列） */
export function readingForMicro(perm: number[], microSlot: number): number {
  const s = slotIndexForMicro(microSlot)
  const reading = perm[s]
  if (typeof reading !== 'number') throw new Error('ERR_VERIFICATION_FAILED')
  return reading
}

/** 槽位中心微槽 = s*130（%1560），与 round(micro/130)%12 取槽一致（槽 s 中心在 s*130，边界在 ±65） */
export function centerForSlot(slot: number): number {
  return (slot * GEOMETRY_PER_DIGIT) % GEOMETRY_MICRO_SLOTS
}

/** 环形最小距离（0–780） */
export function circularMicroDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % GEOMETRY_MICRO_SLOTS
  return Math.min(d, GEOMETRY_MICRO_SLOTS - d)
}

/** 目标小时对应槽位（perm 为排列时唯一；找不到返回 -1） */
export function slotForTargetHour(perm: number[], targetHour: number): number {
  for (let i = 0; i < perm.length; i++) {
    if (perm[i] === targetHour) return i
  }
  return -1
}

/**
 * 语义 + 中心校验：
 * - 读数 != targetHour → ERR_INVALID_POSITION（统一对外 ERR_VERIFICATION_FAILED）
 * - strength==strict 时加中心偏差 ≤30 微槽，否则 ERR_INVALID_POSITION
 */
export function verifyGeometryReading(
  perm: number[],
  targetHour: number,
  microSlot: number,
  strength: CaptchaStrength,
): void {
  if (!isValidPerm(perm) || !isValidTargetHour(targetHour) || !isValidMicroSlot(microSlot)) {
    throw new Error('ERR_VERIFICATION_FAILED')
  }
  const reading = readingForMicro(perm, microSlot)
  if (reading !== targetHour) throw new Error('ERR_INVALID_POSITION')
  if (strength === 'strict') {
    const slot = slotForTargetHour(perm, targetHour)
    if (slot < 0) throw new Error('ERR_INVALID_POSITION')
    const center = centerForSlot(slot)
    const deviation = circularMicroDistance(microSlot, center)
    if (deviation > GEOMETRY_CENTER_DEVIATION_LIMIT) throw new Error('ERR_INVALID_POSITION')
  }
}

/** 行为采样形状校验（数组 + 每项 t/x/y 有限数） */
export function isValidBehaviorSamples(value: unknown): value is BehaviorSample[] {
  if (!Array.isArray(value)) return false
  for (const s of value) {
    if (s === null || typeof s !== 'object') return false
    const rec = s as Record<string, unknown>
    if (
      typeof rec.t !== 'number' ||
      !Number.isFinite(rec.t) ||
      typeof rec.x !== 'number' ||
      !Number.isFinite(rec.x) ||
      typeof rec.y !== 'number' ||
      !Number.isFinite(rec.y)
    ) {
      return false
    }
  }
  return true
}

/**
 * 拖动行为服务端重算（疑似脚本即失败，对外统一码，内部区分日志码）：
 * - 采样数：≥ 强度 minPoints（low≥8/normal≥10/strict≥15，复用滑块冻结值，正交）
 * - 时长：total = last.t - first.t，须在强度 [minTimeMs,maxTimeMs] 内；另受管理 timeout 快照上限
 *   （low/normal ≤ timeoutSec*1000，strict ≤ strictTimeoutSec*1000）
 * - 时序：t 必须严格递增，否则瞬移/伪造
 * - 瞬移：任一段欧氏距离 >500 且 dt<100，或 dt==0 有位移，一律失败
 * - 匀速直线：复用滑块方差启发式（varY/varSpeed，strict 双阈值严判）
 */
export function verifyGeometryBehavior(
  samples: BehaviorSample[],
  strength: CaptchaStrength,
  timeoutSec: number,
  strictTimeoutSec: number,
): void {
  const params = CAPTCHA_STRENGTH_PARAMS[strength]
  if (!Array.isArray(samples) || samples.length < params.minPoints) {
    throw new Error('ERR_AUTOMATION_DETECTED_INVALID_PATH')
  }
  const first = samples[0] as BehaviorSample
  const last = samples[samples.length - 1] as BehaviorSample
  const totalTime = last.t - first.t
  if (!Number.isFinite(totalTime) || totalTime < params.minTimeMs || totalTime > params.maxTimeMs) {
    throw new Error('ERR_AUTOMATION_DETECTED_INVALID_PATH')
  }
  const effectiveTimeoutMs = (strength === 'strict' ? strictTimeoutSec : timeoutSec) * 1000
  if (!Number.isFinite(effectiveTimeoutMs) || totalTime > effectiveTimeoutMs) {
    throw new Error('ERR_AUTOMATION_DETECTED_INVALID_PATH')
  }

  const speeds: number[] = []
  let sumY = 0
  let sumSpeed = 0
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1] as BehaviorSample
    const curr = samples[i] as BehaviorSample
    const dt = curr.t - prev.t
    if (!(dt > 0)) throw new Error('ERR_AUTOMATION_DETECTED_INVALID_PATH')
    sumY += curr.y
    const dx = curr.x - prev.x
    const dy = curr.y - prev.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (!Number.isFinite(dist)) throw new Error('ERR_AUTOMATION_DETECTED_INVALID_PATH')
    // 瞬移启发式：大位移 + 极短耗时视为脚本跳变
    if (dist > 500 && dt < 100) throw new Error('ERR_AUTOMATION_DETECTED_INVALID_PATH')
    const speed = dist / dt
    speeds.push(speed)
    sumSpeed += speed
  }
  if (speeds.length === 0) throw new Error('ERR_AUTOMATION_DETECTED_INVALID_PATH')

  const avgY = sumY / (samples.length - 1)
  const avgSpeed = sumSpeed / speeds.length
  let varY = 0
  let varSpeed = 0
  for (let i = 1; i < samples.length; i++) {
    const p = samples[i] as BehaviorSample
    varY += Math.pow(p.y - avgY, 2)
  }
  for (const s of speeds) {
    varSpeed += Math.pow(s - avgSpeed, 2)
  }
  varY /= samples.length - 1
  varSpeed /= speeds.length

  if (strength === 'low') {
    if (varY === 0 && varSpeed === 0) throw new Error('ERR_AUTOMATION_DETECTED_LINEAR_TRAJECTORY')
  } else if (strength === 'strict') {
    if (varY < STRICT_VARIANCE_THRESHOLDS.varY || varSpeed < STRICT_VARIANCE_THRESHOLDS.varSpeedX) {
      throw new Error('ERR_AUTOMATION_DETECTED_LINEAR_TRAJECTORY')
    }
  } else {
    if (varY === 0 && varSpeed < 0.01) {
      throw new Error('ERR_AUTOMATION_DETECTED_LINEAR_TRAJECTORY')
    }
  }
}

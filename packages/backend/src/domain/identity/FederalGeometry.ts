import { randomInt } from 'crypto'
import type { CaptchaStrength } from './CaptchaChallenge'

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
  /**
   * stroke 笔画序号（P0 H3：前端 GeometryClock strokeRef 递增，多笔提笔重按时递增）。
   * 可选以双兼容旧端（无 s 视为单笔，瞬移按同笔判定；有 s 时仅同 s 内判定瞬移，跨笔跳变不判瞬移）。
   * exactOptionalPropertyTypes 下缺省合法，传值须为有限数。
   */
  s?: number
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

/** 行为采样形状校验（数组 + 每项 t/x/y 有限数 + 可选 s 有限数，双兼容无 s 旧端） */
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
    // s 可选：缺省（undefined）合法（旧端无笔）；传值须为有限数（新端 stroke 序号）
    if (rec.s !== undefined && (typeof rec.s !== 'number' || !Number.isFinite(rec.s))) {
      return false
    }
  }
  return true
}

/**
 * 几何拨针行为阈值（P0 H3 重标，独立于滑块冻结值，禁改 CAPTCHA_STRENGTH_PARAMS/STRICT_VARIANCE_THRESHOLDS）：
 * - 背景：滑块启发式（y 须抖动、速度须变化）对圆盘拨针不成立。短弧微调 y 方差天然小（整数像素+稳手），
 *   strict 旧值 varY<5.0||varSpeed<0.1（OR）系统性误杀（人类 varSpeed≈1e-6–1e-3 恒<0.1，12/6点切线 dy≈0→varY≈0）；
 *   normal 旧值 varY===0&&varSpeed<0.01 误杀水平段（整数 y 恒定 + varSpeed 1e-3<0.01）。
 * - 重标原则：瞬移仅同笔（s）内生效（跨笔提笔重按不判）；直线度改 AND（须 y 方差与速度方差同时极小才判脚本），
 *   阈值取极小 eps（仅完美直线+匀速才拒），strict 在 varY 维略严（0→1e-9→1.0）但仍 AND，保证 10 段真人拨针全过。
 * - 采样/时长：strict 15点→12点、400ms→300ms（允许 12 点/300ms+ 拨针，仍拒 5 点/100ms 快 flick）；
 *   max 沿滑块（low 15000/normal 10000/strict 8000）+ 管理 timeout 快照上限不变。
 * - 瞬移 px/dt：500px/100ms 沿用（同笔内 5000px/s 远超人手，跨笔不判），dt<=0 有位移仍全局拒（伪造）。
 */
export const GEOMETRY_BEHAVIOR_MIN_POINTS: Record<CaptchaStrength, number> = {
  low: 8,
  normal: 10,
  strict: 12,
}

export const GEOMETRY_BEHAVIOR_MIN_TIME_MS: Record<CaptchaStrength, number> = {
  low: 150,
  normal: 200,
  strict: 300,
}

export const GEOMETRY_BEHAVIOR_MAX_TIME_MS: Record<CaptchaStrength, number> = {
  low: 15000,
  normal: 10000,
  strict: 8000,
}

export const GEOMETRY_TELEPORT_PX = 500
export const GEOMETRY_TELEPORT_DT_MS = 100

/** 几何直线度阈值（AND：须同时小于才判脚本；low 最松、strict 在 varY 维略严，varSpeed 全档极小） */
export const GEOMETRY_LINEAR_THRESHOLDS: Record<
  CaptchaStrength,
  { varY: number; varSpeed: number }
> = {
  low: { varY: 1e-12, varSpeed: 1e-12 },
  normal: { varY: 1e-9, varSpeed: 1e-9 },
  strict: { varY: 1.0, varSpeed: 1e-9 },
}

/**
 * 拖动行为服务端重算（疑似脚本即失败，对外统一码，内部区分日志码）：
 * - 采样数：≥ 几何阈值 minPoints（low≥8/normal≥10/strict≥12，P0 H3 重标，独立于滑块 8/10/15）
 * - 时长：total = last.t - first.t，须在几何 [minTimeMs,maxTimeMs] 内（low 150–15000/normal 200–10000/strict 300–8000）；
 *   另受管理 timeout 快照上限（low/normal ≤ timeoutSec*1000，strict ≤ strictTimeoutSec*1000）
 * - 时序：t 必须严格递增，否则伪造（跨笔亦须递增，performance.now() 单调）
 * - 瞬移：仅同笔（s）内判定——同 s（或无 s 旧端视为同笔）且欧氏距离 >500 且 dt<100 即失败；
 *   跨笔（s 不同）跳变不判（提笔重按正常）；dt<=0 有位移全局失败
 * - 匀速直线：几何 AND 启发式（varY/varSpeed 同时极小才判，需查 GEOMETRY_LINEAR_THRESHOLDS）；
 *   targetHour 快照与验证一致：verify 仅用行内 perm/targetHour 快照，不信任客户端传 target（防 farming）
 */
export function verifyGeometryBehavior(
  samples: BehaviorSample[],
  strength: CaptchaStrength,
  timeoutSec: number,
  strictTimeoutSec: number,
): void {
  const minPoints = GEOMETRY_BEHAVIOR_MIN_POINTS[strength]
  const minTimeMs = GEOMETRY_BEHAVIOR_MIN_TIME_MS[strength]
  const maxTimeMs = GEOMETRY_BEHAVIOR_MAX_TIME_MS[strength]
  if (!Array.isArray(samples) || samples.length < minPoints) {
    throw new Error('ERR_AUTOMATION_DETECTED_INVALID_PATH')
  }
  const first = samples[0] as BehaviorSample
  const last = samples[samples.length - 1] as BehaviorSample
  const totalTime = last.t - first.t
  if (!Number.isFinite(totalTime) || totalTime < minTimeMs || totalTime > maxTimeMs) {
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
    // 瞬移启发式（P0 H3）：仅同笔内生效。无 s（旧端）视为同笔以双兼容；有 s 且不同则为跨笔提笔，不判。
    const prevS = prev.s
    const currS = curr.s
    const sameStroke = prevS === undefined || currS === undefined || prevS === currS
    if (sameStroke && dist > GEOMETRY_TELEPORT_PX && dt < GEOMETRY_TELEPORT_DT_MS) {
      throw new Error('ERR_AUTOMATION_DETECTED_INVALID_PATH')
    }
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

  // 几何直线度（P0 H3）：AND 极小 eps，仅完美直线+匀速才拒（拨针短弧/水平段全过，匀速直线仍拒）
  const linear = GEOMETRY_LINEAR_THRESHOLDS[strength]
  if (varY < linear.varY && varSpeed < linear.varSpeed) {
    throw new Error('ERR_AUTOMATION_DETECTED_LINEAR_TRAJECTORY')
  }
}

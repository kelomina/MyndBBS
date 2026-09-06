import {
  GEOMETRY_MICRO_SLOTS,
  generatePerm,
  readingForMicro,
  centerForSlot,
  circularMicroDistance,
  slotForTargetHour,
  verifyGeometryReading,
  verifyGeometryBehavior,
  isValidMicroSlot,
  isValidBehaviorSamples,
  GEOMETRY_BEHAVIOR_MIN_POINTS,
  GEOMETRY_LINEAR_THRESHOLDS,
  type BehaviorSample,
} from '../src/domain/identity/FederalGeometry'

function makeHumanSamples(count: number, durationMs: number): BehaviorSample[] {
  const samples: BehaviorSample[] = []
  for (let i = 0; i < count; i++) {
    const t = Math.round((durationMs * i) / (count - 1))
    // 人类弧线：x 递增 + y 正弦抖动，保证 varY/varSpeed 非零
    samples.push({
      t,
      x: i * 12 + Math.sin(i * 0.9) * 4,
      y: 100 + Math.sin(i * 1.1) * 12 + (i % 3) * 2,
    })
  }
  return samples
}

describe('FederalGeometry hour-clock domain', () => {
  it('exposes 1560 micro slots with 130 per digit', () => {
    expect(GEOMETRY_MICRO_SLOTS).toBe(1560)
    expect(1560 / 12).toBe(130)
  })

  it('generates perm as 0-11 permutation without Math.random dependency', () => {
    const perm = generatePerm()
    expect(perm).toHaveLength(12)
    expect([...perm].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  it('computes reading as perm[round(micro/130)%12]', () => {
    const perm = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    expect(readingForMicro(perm, 0)).toBe(0)
    expect(readingForMicro(perm, 65)).toBe(1)
    expect(readingForMicro(perm, 130)).toBe(1)
    expect(readingForMicro(perm, 1559)).toBe(0)
  })

  it('accepts semantic hit for default strength without center check', () => {
    const perm = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    // slot 3 中心 390，边缘 420 仍语义命中（默认档不查中心；round 口径下 390±65 均为槽 3）
    expect(() => verifyGeometryReading(perm, 3, 390, 'low')).not.toThrow()
    expect(() => verifyGeometryReading(perm, 3, 420, 'low')).not.toThrow()
    expect(() => verifyGeometryReading(perm, 3, 420, 'normal')).not.toThrow()
  })

  it('rejects wrong semantic reading', () => {
    const perm = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    expect(() => verifyGeometryReading(perm, 3, 0, 'low')).toThrow('ERR_INVALID_POSITION')
  })

  it('enforces center deviation <=30 for strict', () => {
    const perm = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    const slot = slotForTargetHour(perm, 3)
    expect(slot).toBe(3)
    const center = centerForSlot(slot)
    expect(center).toBe(390)
    // 中心通过
    expect(() => verifyGeometryReading(perm, 3, 390, 'strict')).not.toThrow()
    // 偏差 30 通过（边界：390+30=420 仍槽 3 且偏差 30）
    expect(() => verifyGeometryReading(perm, 3, 420, 'strict')).not.toThrow()
    expect(circularMicroDistance(420, 390)).toBe(30)
    // 偏差 60（槽边缘 450 → round 到 3 但偏差 60）拒绝
    expect(() => verifyGeometryReading(perm, 3, 450, 'strict')).toThrow('ERR_INVALID_POSITION')
  })

  it('validates microSlot range 0-1559', () => {
    expect(isValidMicroSlot(0)).toBe(true)
    expect(isValidMicroSlot(1559)).toBe(true)
    expect(isValidMicroSlot(1560)).toBe(false)
    expect(isValidMicroSlot(-1)).toBe(false)
    expect(isValidMicroSlot(1.5)).toBe(false)
  })

  it('accepts human behavior samples', () => {
    const samples = makeHumanSamples(12, 1200)
    expect(() => verifyGeometryBehavior(samples, 'normal', 10, 15)).not.toThrow()
  })

  it('rejects too few samples', () => {
    const samples = makeHumanSamples(5, 1000)
    expect(() => verifyGeometryBehavior(samples, 'normal', 10, 15)).toThrow()
  })

  it('rejects teleport jumps', () => {
    const samples = makeHumanSamples(12, 1200)
    const bad = samples.map((s) => ({ ...s }))
    const target = bad[6]
    if (target) {
      target.x = (bad[5]?.x ?? 0) + 600
      target.t = (bad[5]?.t ?? 0) + 10
    }
    expect(() => verifyGeometryBehavior(bad, 'normal', 10, 15)).toThrow()
  })

  it('rejects uniform straight-line script', () => {
    const straight: BehaviorSample[] = []
    for (let i = 0; i < 12; i++) straight.push({ t: i * 100, x: i * 10, y: 50 })
    expect(() => verifyGeometryBehavior(straight, 'normal', 10, 15)).toThrow()
  })

  it('enforces admin timeout snapshot upper bound', () => {
    const samples = makeHumanSamples(12, 12000)
    // 时长 12s > timeoutSec 10s → 拒绝（默认档）
    expect(() => verifyGeometryBehavior(samples, 'low', 10, 15)).toThrow()
  })

  it('exposes recalibrated geometry thresholds (P0 H3, independent of slider)', () => {
    // strict 15点→12点、400ms→300ms（拨针友好，仍拒 5 点/100ms flick）；直线度 AND 极小 eps
    expect(GEOMETRY_BEHAVIOR_MIN_POINTS.strict).toBe(12)
    expect(GEOMETRY_LINEAR_THRESHOLDS.strict.varSpeed).toBeLessThan(1e-6)
    expect(GEOMETRY_LINEAR_THRESHOLDS.strict.varY).toBeLessThanOrEqual(1.0)
  })
})

/**
 * P0 H3 服务端重标验证：s 笔画 + 10 段真人拨针全过 + 攻击仍拒。
 * 合成拨针约束（对齐前端 GeometryClock 取证）：
 * - t=performance.now() 毫秒（严格递增，rAF 约 60Hz）、x/y=clientX/clientY 视口 CSS 像素整数
 * - 单笔/多笔（s 递增），弧线 + 正弦抖动 + 变速（加速/减速），时长 500–2000ms，点数 14–24
 */
function makeDialSamples(
  seed: number,
  count = 16,
  durationMs = 900,
  strokes = 1,
): BehaviorSample[] {
  const samples: BehaviorSample[] = []
  // 确定性伪随机（禁 Math.random 仅测试合成，生产 RNG 仍 crypto）
  let s = seed * 1000 + 7
  const rnd = (): number => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
  const cx = 400 + (seed % 5) * 37
  const cy = 300 + (seed % 7) * 23
  const baseR = 60 + (seed % 4) * 15
  const arcSpan = Math.PI * (0.4 + (seed % 5) * 0.15)
  const startAng = (seed % 12) * ((2 * Math.PI) / 12)
  const perStroke = Math.ceil(count / strokes)
  let idx = 0
  for (let st = 1; st <= strokes && idx < count; st++) {
    const n = Math.min(perStroke, count - idx)
    // 每笔起点在弧上连续（跨笔跳变由调用方显式构造，此处多笔为连续提笔微调，无大跳变）
    for (let i = 0; i < n; i++) {
      const frac = n === 1 ? 1 : i / (n - 1)
      // 变速：ease-in-out + 抖动（人手加速/减速，速度方差远大于 1e-9）
      const eased = frac * frac * (3 - 2 * frac) + Math.sin(frac * Math.PI * 2 + seed) * 0.03
      const ang = startAng + arcSpan * Math.min(1, Math.max(0, eased))
      const r = baseR + Math.sin(frac * 5 + seed) * 3
      const x = Math.round(cx + r * Math.cos(ang) + (rnd() - 0.5) * 2)
      const y = Math.round(cy + r * Math.sin(ang) + (rnd() - 0.5) * 2)
      // t：非线性（变速）+ 整数 ms，严格递增
      const t = Math.round((durationMs * (idx + frac * 0.9)) / (count - 1) + st * 0.5)
      samples.push({ t, x, y, s: st })
      idx++
    }
  }
  // 保证严格递增（合成舍入可能产生 dt=0，逐个+1 修正，不改变语义）
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1] as BehaviorSample
    const curr = samples[i] as BehaviorSample
    if (!(curr.t > prev.t)) curr.t = prev.t + 16 + (i % 5)
  }
  return samples
}

describe('FederalGeometry H3 stroke + recalibration (P0)', () => {
  it('accepts s-bearing samples shape (dual-compatible with legacy no-s)', () => {
    expect(isValidBehaviorSamples([{ t: 0, x: 1, y: 2 }])).toBe(true)
    expect(isValidBehaviorSamples([{ t: 0, x: 1, y: 2, s: 1 }])).toBe(true)
    expect(isValidBehaviorSamples([{ t: 0, x: 1, y: 2, s: 2 }])).toBe(true)
    expect(isValidBehaviorSamples([{ t: 0, x: 1, y: 2, s: NaN }])).toBe(false)
    expect(isValidBehaviorSamples([{ t: 0, x: 1, y: 2, s: '1' }])).toBe(false)
    expect(isValidBehaviorSamples([{ t: NaN, x: 1, y: 2 }])).toBe(false)
  })

  it('ignores cross-stroke jumps but rejects same-stroke teleport', () => {
    const base = makeDialSamples(1, 16, 900, 1)
    // 同笔大跳变 600px/10ms → 拒
    const sameStroke = base.map((v) => ({ ...v }))
    const victim = sameStroke[8]
    const anchor = sameStroke[7]
    if (victim && anchor) {
      victim.x = anchor.x + 600
      victim.t = anchor.t + 10
      victim.s = anchor.s
    }
    expect(() => verifyGeometryBehavior(sameStroke, 'strict', 60, 15)).toThrow(
      'ERR_AUTOMATION_DETECTED_INVALID_PATH',
    )
    // 同样跳变但跨笔（s 不同，提笔重按）→ 不判瞬移，通过（线性/时长仍须过，此合成满足）
    const crossStroke = base.map((v) => ({ ...v }))
    const victim2 = crossStroke[8]
    const anchor2 = crossStroke[7]
    if (victim2 && anchor2) {
      victim2.x = anchor2.x + 600
      victim2.t = anchor2.t + 10
      victim2.s = (anchor2.s ?? 1) + 1
      // 后续点同新笔，保持时序递增（跨笔后 s 一致，避免连锁误判）
      for (let i = 9; i < crossStroke.length; i++) {
        const p = crossStroke[i]
        if (p) p.s = victim2.s
      }
    }
    expect(() => verifyGeometryBehavior(crossStroke, 'strict', 60, 15)).not.toThrow()
    // 旧端无 s 同样跳变 → 视为同笔，仍拒（双兼容）
    const legacy = base.map(({ t, x, y }) => ({ t, x, y }))
    const victim3 = legacy[8]
    const anchor3 = legacy[7]
    if (victim3 && anchor3) {
      victim3.x = anchor3.x + 600
      victim3.t = anchor3.t + 10
    }
    expect(() => verifyGeometryBehavior(legacy as BehaviorSample[], 'strict', 60, 15)).toThrow(
      'ERR_AUTOMATION_DETECTED_INVALID_PATH',
    )
  })

  it('passes 10 human dial samples under strict (sampling/duration/teleport/linearity)', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const strokes = seed % 3 === 0 ? 2 : 1
      const count = 14 + (seed % 5)
      const duration = 600 + (seed % 4) * 300
      const samples = makeDialSamples(seed, count, duration, strokes)
      expect(samples.length).toBeGreaterThanOrEqual(12)
      expect(() => verifyGeometryBehavior(samples, 'strict', 60, 15)).not.toThrow()
      expect(() => verifyGeometryBehavior(samples, 'normal', 60, 15)).not.toThrow()
      expect(() => verifyGeometryBehavior(samples, 'low', 60, 15)).not.toThrow()
    }
  })

  it('still rejects uniform straight-line under strict recalibration', () => {
    const straight: BehaviorSample[] = []
    for (let i = 0; i < 16; i++) straight.push({ t: i * 60, x: 100 + i * 8, y: 200, s: 1 })
    expect(() => verifyGeometryBehavior(straight, 'strict', 60, 15)).toThrow(
      'ERR_AUTOMATION_DETECTED_LINEAR_TRAJECTORY',
    )
    expect(() => verifyGeometryBehavior(straight, 'normal', 60, 15)).toThrow()
    expect(() => verifyGeometryBehavior(straight, 'low', 60, 15)).toThrow()
  })

  it('still rejects too-fast flick under strict (duration < minTimeMs)', () => {
    const fast = makeDialSamples(7, 14, 900, 1)
    // 压缩到 200ms（< strict 300ms，但 ≥ low 150/normal 200）：仅 strict 拒，low/normal 过
    const compressed: BehaviorSample[] = fast.map((p, i) => ({
      ...p,
      t: Math.round((200 * i) / (fast.length - 1)),
    }))
    expect(() => verifyGeometryBehavior(compressed, 'strict', 60, 15)).toThrow(
      'ERR_AUTOMATION_DETECTED_INVALID_PATH',
    )
    // 极快 80ms：全档拒
    const veryFast: BehaviorSample[] = fast.map((p, i) => ({
      ...p,
      t: Math.round((80 * i) / (fast.length - 1)),
    }))
    expect(() => verifyGeometryBehavior(veryFast, 'low', 60, 15)).toThrow()
  })

  it('still rejects too-few samples under strict', () => {
    const few = makeDialSamples(3, 5, 800, 1)
    expect(() => verifyGeometryBehavior(few, 'strict', 60, 15)).toThrow()
  })
})

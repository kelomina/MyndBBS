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
})

import { hashPowChallenge, countLeadingZeroBits, verifyPowNonce } from '../src/lib/federalPow'
import {
  verifyGeometryReading,
  slotForTargetHour,
  centerForSlot,
  type BehaviorSample,
} from '../src/domain/identity/FederalGeometry'
import { TEST_FEDERAL_DEFAULTS } from '../src/application/identity/FederalCaptchaService'

/**
 * P0 H5 跨端固定向量（前后端互断言，防复发）：
 * - PoW：与前端 `packages/frontend/src/lib/federal/sha256.ts:80-83 powHash`
 *   + Worker 模板 `:105` + `PowCollector.tsx:128/183` 同口径（'|' 0x7C）互断言；
 *   演示 ground truth（`sha256.ts:3-5`）亦为 '|' 口径，后端已对齐（`src/lib/federalPow.ts:11-15`）。
 * - 几何：perm 恒等 + targetHour=3 成功向量（`TEST_FEDERAL_DEFAULTS` testFixed 行语义，issue/verify 快照一致）。
 */
describe('Federal cross-end fixed vectors (H5)', () => {
  it('pow: backend digest matches frontend ground truth for fixed challenge/nonce', () => {
    const challengeHex = TEST_FEDERAL_DEFAULTS.powChallengeHex
    const nonce = TEST_FEDERAL_DEFAULTS.powNonce
    const bits = TEST_FEDERAL_DEFAULTS.powBits
    expect(challengeHex).toBe('0123456789abcdef0123456789abcdef')
    expect(nonce).toBe('13')
    expect(bits).toBe(8)
    const digest = hashPowChallenge(challengeHex, nonce)
    // 前端 powHash('0123…','13') === SHA256('0123…|13') === 以下 hex（node:crypto 与纯 JS SHA-256 双算一致，已实测）：
    // 后端 0025b120… / 前端 0025b120…（见 P0 R0 实测帧，旧 '0' 在 '|' 下仅 69ace8…/1bit 已作废）
    expect(digest.toString('hex')).toBe(
      '0025b120f0ff25a607c96117b781129351077fd0a0b28c91f09ef7ac5608abe2',
    )
    expect(countLeadingZeroBits(digest)).toBeGreaterThanOrEqual(8)
    expect(verifyPowNonce(challengeHex, nonce, 8)).toBe(true)
    // 回归守卫：旧无 '|' 口径解 '0' 在 '|' 下必失败（防回退到无分隔符口径）
    expect(verifyPowNonce(challengeHex, '0', 8)).toBe(false)
  })

  it('geometry: identity perm + targetHour=3 semantic hit for all strengths (snapshot-consistent)', () => {
    const perm = [...TEST_FEDERAL_DEFAULTS.geometryPerm]
    expect(perm).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    const targetHour = TEST_FEDERAL_DEFAULTS.geometryTargetHour
    expect(targetHour).toBe(3)
    const slot = slotForTargetHour(perm, targetHour)
    expect(slot).toBe(3)
    const center = centerForSlot(slot)
    expect(center).toBe(390)
    // 中心微槽 390：读数=perm[round(390/130)%12]=perm[3]=3，语义命中；strict 加中心偏差 0≤30 亦过
    for (const strength of ['low', 'normal', 'strict'] as const) {
      expect(() => verifyGeometryReading(perm, targetHour, 390, strength)).not.toThrow()
    }
    // 行为样本双兼容注记：testFixed 行拖拽豁免（service 层），此处仅断言语义向量；
    // 非 testFixed 行行为重算见 federalGeometry.test.ts（含 s 同笔/跨笔 + 10 段拨针 + 攻击仍拒）
    const _note: BehaviorSample[] = []
    void _note
  })

  it('geometry H4: targetHour=0 identity vector passes all strengths (no degraded misjudgment)', () => {
    const perm = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    // targetHour=0（≈8.3% 概率）：后端 0–11（isValidTargetHour/generateTargetHour），
    // 前端 hasGeometryInteractable 已对齐 0–11（原 1–12 致 degraded，前端文件已修，本后端向量锁定语义）
    const slot = slotForTargetHour(perm, 0)
    expect(slot).toBe(0)
    expect(centerForSlot(slot)).toBe(0)
    for (const strength of ['low', 'normal', 'strict'] as const) {
      expect(() => verifyGeometryReading(perm, 0, 0, strength)).not.toThrow()
    }
    // 错位姿仍拒（快照一致性：仅快照 targetHour 命中才过）
    expect(() => verifyGeometryReading(perm, 0, 390, 'low')).toThrow('ERR_INVALID_POSITION')
  })
})

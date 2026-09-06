import {
  hashPowChallenge,
  countLeadingZeroBits,
  verifyPowNonce,
  isValidChallengeHex,
  isValidNonce,
} from '../src/lib/federalPow'

describe('FederalPow single-hash leading-zero', () => {
  it('validates challengeHex shape (128bit hex32)', () => {
    expect(isValidChallengeHex('0123456789abcdef0123456789abcdef')).toBe(true)
    expect(isValidChallengeHex('xyz')).toBe(false)
    expect(isValidChallengeHex('0123456789abcdef0123456789abcde')).toBe(false)
    expect(isValidChallengeHex(123)).toBe(false)
  })

  it('validates nonce shape 1-256', () => {
    expect(isValidNonce('0')).toBe(true)
    expect(isValidNonce('')).toBe(false)
    expect(isValidNonce('a'.repeat(256))).toBe(true)
    expect(isValidNonce('a'.repeat(257))).toBe(false)
  })

  it('counts leading zero bits MSB-first', () => {
    expect(countLeadingZeroBits(Buffer.from([0x00, 0xff]))).toBe(8)
    expect(countLeadingZeroBits(Buffer.from([0x0f]))).toBe(4)
    expect(countLeadingZeroBits(Buffer.from([0x80]))).toBe(0)
  })

  it('verifies fixed test vector with single hash', () => {
    const challengeHex = '0123456789abcdef0123456789abcdef'
    // '|' 口径固定解（与前端 powHash ground truth 一致）：challenge+'|'+'13' → 0025b120…前导零10bits
    // 旧 nonce '0' 在无 '|' 口径下通过、在 '|' 口径下仅1bit（69ace8…），P0 R0 已证伪作废
    const nonce = '13'
    const digest = hashPowChallenge(challengeHex, nonce)
    expect(digest).toHaveLength(32)
    // 双端 digest 一致：后端 node:crypto 与前端纯 JS SHA-256 同一原像同一摘要（跨端固定向量，见 federalCrossVectors.test.ts）
    expect(digest.toString('hex')).toBe(
      '0025b120f0ff25a607c96117b781129351077fd0a0b28c91f09ef7ac5608abe2',
    )
    expect(countLeadingZeroBits(digest)).toBeGreaterThanOrEqual(8)
    expect(verifyPowNonce(challengeHex, nonce, 8)).toBe(true)
  })

  it('rejects tampered nonce', () => {
    const challengeHex = '0123456789abcdef0123456789abcdef'
    // 'tampered-nonce-xyz' 大概率不满足 16bits（若极小概率通过则换 nonce，但 8bits 下需显式找反例）
    const bad = 'zzzz-not-a-solution-000000'
    const digest = hashPowChallenge(challengeHex, bad)
    // 至少断言函数可执行且返回布尔；若恰好通过则跳过（概率 <1/256）
    if (countLeadingZeroBits(digest) < 8) {
      expect(verifyPowNonce(challengeHex, bad, 8)).toBe(false)
    }
  })

  it('verifies within 50ms backend budget (single hash, no search loop)', () => {
    const challengeHex = '0123456789abcdef0123456789abcdef'
    const start = Date.now()
    verifyPowNonce(challengeHex, '13', 8)
    expect(Date.now() - start).toBeLessThan(50)
  })

  it('is strength-orthogonal: bits is sole difficulty source', () => {
    const challengeHex = '0123456789abcdef0123456789abcdef'
    // 同一 nonce 在 8bits 下通过，在 24bits 下几乎必失败（若通过则说明测试向量需更换，但概率极低）
    expect(verifyPowNonce(challengeHex, '13', 8)).toBe(true)
    const digest = hashPowChallenge(challengeHex, '13')
    if (countLeadingZeroBits(digest) < 24) {
      expect(verifyPowNonce(challengeHex, '13', 24)).toBe(false)
    }
  })
})

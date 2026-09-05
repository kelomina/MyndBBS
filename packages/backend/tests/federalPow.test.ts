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
    const nonce = '0'
    const digest = hashPowChallenge(challengeHex, nonce)
    expect(digest).toHaveLength(32)
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
    verifyPowNonce(challengeHex, '0', 8)
    expect(Date.now() - start).toBeLessThan(50)
  })

  it('is strength-orthogonal: bits is sole difficulty source', () => {
    const challengeHex = '0123456789abcdef0123456789abcdef'
    // 同一 nonce 在 8bits 下通过，在 24bits 下几乎必失败（若通过则说明测试向量需更换，但概率极低）
    expect(verifyPowNonce(challengeHex, '0', 8)).toBe(true)
    const digest = hashPowChallenge(challengeHex, '0')
    if (countLeadingZeroBits(digest) < 24) {
      expect(verifyPowNonce(challengeHex, '0', 24)).toBe(false)
    }
  })
})

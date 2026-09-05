import { createHash } from 'crypto'

/**
 * 联邦 PoW 单一入口（前后端同一口径，零外部依赖）。
 * - 哈希输入：UTF-8(challengeHex + nonce) 单次 SHA-256（禁搜索循环，调用方只做一次）
 * - 前导零计数：MSB 优先逐位计数（bits 口径前后端一致）
 * - 后端单次验证 CPU ≤50ms（单哈希 + 上界循环，天然成立）
 */

/** 单次 SHA-256(challengeHex + nonce)，返回 32 字节摘要 */
export function hashPowChallenge(challengeHex: string, nonce: string): Buffer {
  return createHash('sha256')
    .update(challengeHex + nonce, 'utf8')
    .digest()
}

/** 统计摘要前导零 bits（MSB 优先） */
export function countLeadingZeroBits(digest: Buffer): number {
  let bits = 0
  for (let i = 0; i < digest.length; i++) {
    const byte = digest[i] as number
    if (byte === 0) {
      bits += 8
      continue
    }
    for (let b = 7; b >= 0; b--) {
      if (((byte >> b) & 1) === 0) bits += 1
      else return bits
    }
    return bits
  }
  return bits
}

/** 判定 nonce 是否达标（单哈希 + 计数，调用方不得循环搜索） */
export function verifyPowNonce(challengeHex: string, nonce: string, bits: number): boolean {
  if (!Number.isInteger(bits) || bits < 0 || bits > 256) return false
  const digest = hashPowChallenge(challengeHex, nonce)
  return countLeadingZeroBits(digest) >= bits
}

/** 校验 challengeHex 形状（128bit hex32） */
export function isValidChallengeHex(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-fA-F]{32}$/.test(value)
}

/** 校验 nonce 形状（1–256 字符，与 SPEC FederalPowVerify 一致；编码 hex/base64 均接受，只限长度） */
export function isValidNonce(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 256
}

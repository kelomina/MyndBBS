/**
 * 解锁凭证 JWT（API-SPEC x-unlock-token 冻结）
 * - HS256，复用现有 auth secret 体系（TEMP_TOKEN_SECRET，不新增明文 secret 落盘）
 * - 载荷 typ=ratelimit-unlock（独立鉴别；login/registration tempToken 冒充必拒）+ ip + jti + exp + iat + strength
 * - exp/expiresAt/TTL 均为签发时 exemptionMinutes 快照（test 下 TEST_EXEMPT_SEC 秒级）；管理改值不重算旧 token
 * - 载体冻结为请求头 X-RateLimit-Unlock 唯一（无 cookie）
 */
import jwt from 'jsonwebtoken'
import { randomUUID as uuidv4 } from 'crypto'
import { getTempTokenSecret } from './securityConfig'
import type { CaptchaStrength } from '../domain/identity/CaptchaChallenge'

export const UNLOCK_TOKEN_TYP = 'ratelimit-unlock'
export const UNLOCK_HEADER_NAME = 'x-ratelimit-unlock'

export interface UnlockTokenPayload {
  typ: typeof UNLOCK_TOKEN_TYP
  ip: string
  jti: string
  strength: CaptchaStrength
  iat: number
  exp: number
}

function getTestExemptSec(): number | null {
  if (process.env.NODE_ENV !== 'test') return null
  const raw = process.env.TEST_EXEMPT_SEC
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 86400) return null
  return n
}

export function getExemptTtlSec(exemptionMinutes: number): number {
  const testSec = getTestExemptSec()
  if (testSec !== null) return testSec
  const minutes = Number.isInteger(exemptionMinutes) ? exemptionMinutes : 15
  return Math.max(60, Math.min(120 * 60, minutes * 60))
}

export function signUnlockToken(params: {
  ip: string
  exemptionMinutes: number
  strength: CaptchaStrength
}): {
  token: string
  jti: string
  expiresAt: Date
  exemptSeconds: number
} {
  const jti = uuidv4()
  const exemptSeconds = getExemptTtlSec(params.exemptionMinutes)
  const nowSec = Math.floor(Date.now() / 1000)
  const payload = {
    typ: UNLOCK_TOKEN_TYP,
    ip: params.ip,
    jti,
    strength: params.strength,
    iat: nowSec,
    exp: nowSec + exemptSeconds,
  }
  const token = jwt.sign(payload, getTempTokenSecret(), { algorithm: 'HS256' })
  return { token, jti, expiresAt: new Date((nowSec + exemptSeconds) * 1000), exemptSeconds }
}

export function verifyUnlockToken(token: string): UnlockTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getTempTokenSecret(), { algorithms: ['HS256'] }) as Record<
      string,
      unknown
    >
    if (!decoded || decoded['typ'] !== UNLOCK_TOKEN_TYP) return null
    const ip = decoded['ip']
    const jti = decoded['jti']
    const strength = decoded['strength']
    const exp = decoded['exp']
    const iat = decoded['iat']
    if (typeof ip !== 'string' || ip.length === 0) return null
    if (typeof jti !== 'string' || jti.length === 0) return null
    if (strength !== 'low' && strength !== 'normal' && strength !== 'strict') return null
    if (typeof exp !== 'number' || typeof iat !== 'number') return null
    return { typ: UNLOCK_TOKEN_TYP, ip, jti, strength, iat, exp }
  } catch {
    return null
  }
}

export function getTestExemptMinutesSnapshot(exemptionMinutes: number): number {
  const testSec = getTestExemptSec()
  if (testSec !== null) return testSec / 60
  return exemptionMinutes
}

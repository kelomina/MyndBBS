/**
 * 联邦兑换凭证（一次性 redeem，一证一兑，防重放/双花）
 *
 * 增量：解锁兑换扩展到联邦题型（去 H2 滑块门控，用户已批准）。
 * - verify 成功时签发一次性兑换凭证（绑定 captchaId+kind+ip+jti，短 TTL 5 分钟），
 *   verify 与删行/发凭证原子（先存凭证再删行，删行失败回滚凭证，仅一胜）。
 * - /unlock 凭该凭证+kind 兑换 unlockToken 并消费凭证（一证一兑）；
 *   未解题 captchaId、跨 kind 冒充、过期/复用凭证一律统一 400 ERR_VERIFICATION_FAILED。
 * - JWT 复用 TEMP_TOKEN_SECRET（不新增明文 secret 落盘），typ=federal-redeem 独立鉴别，
 *   与 ratelimit-unlock / login tempToken 互斥，冒充必拒。
 * - 服务端记录为准（签名∧IP∧记录 AND，任一失败→400）；存储 Redis 优先内存回退，
 *   key=federal:redeem:<jti>，TTL=签发时快照（test 下 TEST_FEDERAL_REDEEM_SEC 秒级）。
 * - 强度正交：redeem 仅携带 strength 快照供观测/日志，不改变豁免效力；
 *   豁免仍为签发时 exemptionMinutes 快照（默认 15 分钟），审计语义不变。
 * - 旧滑块/unlock 三件套路径保持兼容（/unlock 双模式：drag 直兑 vs redeem 兑换）。
 */
import jwt from 'jsonwebtoken'
import { randomUUID as uuidv4 } from 'crypto'
import { redis } from './redis'
import { getTempTokenSecret } from './securityConfig'
import type { CaptchaStrength } from '../domain/identity/CaptchaChallenge'
import type { FederalKind } from '../domain/system/FederalProtection'

export const FEDERAL_REDEEM_TYP = 'federal-redeem'
export const FEDERAL_REDEEM_TTL_SEC = 300
export const FEDERAL_REDEEM_EXPIRES_IN_SEC = 300

export interface FederalRedeemPayload {
  typ: typeof FEDERAL_REDEEM_TYP
  captchaId: string
  kind: FederalKind
  ip: string
  jti: string
  strength: CaptchaStrength
  iat: number
  exp: number
}

export interface FederalRedeemRecord {
  captchaId: string
  kind: FederalKind
  ip: string
  strength: CaptchaStrength
  jti: string
}

export function isFederalRedeemKind(value: unknown): value is FederalKind {
  return value === 'slider' || value === 'geometry' || value === 'pow'
}

function getTestFederalRedeemSec(): number | null {
  if (process.env.NODE_ENV !== 'test') return null
  const raw = process.env.TEST_FEDERAL_REDEEM_SEC
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 86400) return null
  return n
}

export function getFederalRedeemTtlSec(): number {
  const testSec = getTestFederalRedeemSec()
  if (testSec !== null) return testSec
  return FEDERAL_REDEEM_TTL_SEC
}

export function signFederalRedeem(params: {
  captchaId: string
  kind: FederalKind
  ip: string
  strength: CaptchaStrength
  ttlSec?: number
}): { token: string; jti: string; expiresAt: Date; ttlSec: number } {
  const ttl =
    typeof params.ttlSec === 'number' && Number.isInteger(params.ttlSec) && params.ttlSec >= 1
      ? Math.min(86400, params.ttlSec)
      : getFederalRedeemTtlSec()
  const jti = uuidv4()
  const nowSec = Math.floor(Date.now() / 1000)
  const payload = {
    typ: FEDERAL_REDEEM_TYP,
    captchaId: params.captchaId,
    kind: params.kind,
    ip: params.ip,
    jti,
    strength: params.strength,
    iat: nowSec,
    exp: nowSec + ttl,
  }
  const token = jwt.sign(payload, getTempTokenSecret(), { algorithm: 'HS256' })
  return { token, jti, expiresAt: new Date((nowSec + ttl) * 1000), ttlSec: ttl }
}

export function verifyFederalRedeem(token: string): FederalRedeemPayload | null {
  try {
    const decoded = jwt.verify(token, getTempTokenSecret(), {
      algorithms: ['HS256'],
    }) as Record<string, unknown>
    if (!decoded || decoded['typ'] !== FEDERAL_REDEEM_TYP) return null
    const captchaId = decoded['captchaId']
    const kind = decoded['kind']
    const ip = decoded['ip']
    const jti = decoded['jti']
    const strength = decoded['strength']
    const exp = decoded['exp']
    const iat = decoded['iat']
    if (typeof captchaId !== 'string' || captchaId.length === 0) return null
    if (!isFederalRedeemKind(kind)) return null
    if (typeof ip !== 'string' || ip.length === 0) return null
    if (typeof jti !== 'string' || jti.length === 0) return null
    if (strength !== 'low' && strength !== 'normal' && strength !== 'strict') return null
    if (typeof exp !== 'number' || typeof iat !== 'number') return null
    return { typ: FEDERAL_REDEEM_TYP, captchaId, kind, ip, jti, strength, iat, exp }
  } catch {
    return null
  }
}

const KEY_PREFIX = 'federal:redeem:'

function buildKey(jti: string): string {
  return `${KEY_PREFIX}${jti}`
}

type MemoryEntry = { value: string; expiresAt: number }

class MemoryFallback {
  private data = new Map<string, MemoryEntry>()

  set(key: string, value: string, ttlSec: number): void {
    this.data.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 })
  }

  get(key: string): string | null {
    const entry = this.data.get(key)
    if (!entry) return null
    if (Date.now() >= entry.expiresAt) {
      this.data.delete(key)
      return null
    }
    return entry.value
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  delete(key: string): void {
    this.data.delete(key)
  }

  clearAll(): void {
    this.data.clear()
  }
}

const memoryFallback = new MemoryFallback()

async function redisSetEx(key: string, value: string, ttlSec: number): Promise<boolean> {
  try {
    const client = redis as unknown as {
      set?: (k: string, v: string, mode?: string, dur?: number) => Promise<unknown>
    }
    if (!client || typeof client.set !== 'function') return false
    await client.set(key, value, 'EX', Math.max(1, Math.floor(ttlSec)))
    return true
  } catch {
    return false
  }
}

async function redisGet(key: string): Promise<string | null | undefined> {
  try {
    const client = redis as unknown as { get?: (k: string) => Promise<string | null> }
    if (!client || typeof client.get !== 'function') return undefined
    return await client.get(key)
  } catch {
    return undefined
  }
}

async function redisGetDel(key: string): Promise<string | null | undefined> {
  try {
    const client = redis as unknown as {
      getdel?: (k: string) => Promise<string | null>
      get?: (k: string) => Promise<string | null>
      del?: (...keys: string[]) => Promise<unknown>
    }
    if (!client) return undefined
    if (typeof client.getdel === 'function') {
      return await client.getdel(key)
    }
    if (typeof client.get === 'function' && typeof client.del === 'function') {
      const val = await client.get(key)
      if (val !== null && val !== undefined) {
        await client.del(key).catch(() => undefined)
      }
      return val
    }
    return undefined
  } catch {
    return undefined
  }
}

async function redisDel(key: string): Promise<void> {
  try {
    const client = redis as unknown as { del?: (...keys: string[]) => Promise<unknown> }
    if (!client || typeof client.del !== 'function') return
    await client.del(key)
  } catch {
    // ignore
  }
}

async function redisClearAll(): Promise<void> {
  try {
    const client = redis as unknown as {
      keys?: (p: string) => Promise<string[]>
      del?: (...keys: string[]) => Promise<unknown>
    }
    if (!client || typeof client.keys !== 'function' || typeof client.del !== 'function') return
    const keys = await client.keys(`${KEY_PREFIX}*`)
    if (keys && keys.length > 0) await client.del(...keys)
  } catch {
    // ignore
  }
}

function parseRecord(raw: string): FederalRedeemRecord | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const captchaId = parsed['captchaId']
    const kind = parsed['kind']
    const ip = parsed['ip']
    const strength = parsed['strength']
    const jti = parsed['jti']
    if (typeof captchaId !== 'string' || captchaId.length === 0) return null
    if (!isFederalRedeemKind(kind)) return null
    if (typeof ip !== 'string' || ip.length === 0) return null
    if (strength !== 'low' && strength !== 'normal' && strength !== 'strict') return null
    if (typeof jti !== 'string' || jti.length === 0) return null
    return { captchaId, kind, ip, strength, jti }
  } catch {
    return null
  }
}

export const federalRedeemStore = {
  buildKey,

  async save(jti: string, record: FederalRedeemRecord, ttlSec: number): Promise<void> {
    const key = buildKey(jti)
    const ttl = Math.max(1, Math.floor(ttlSec))
    const value = JSON.stringify(record)
    memoryFallback.set(key, value, ttl)
    await redisSetEx(key, value, ttl)
  },

  async has(jti: string): Promise<boolean> {
    const key = buildKey(jti)
    if (memoryFallback.has(key)) return true
    const redisVal = await redisGet(key)
    if (typeof redisVal === 'string' && redisVal.length > 0) {
      const parsed = parseRecord(redisVal)
      return parsed !== null
    }
    return false
  },

  async consume(jti: string): Promise<FederalRedeemRecord | null> {
    const key = buildKey(jti)
    const memRaw = memoryFallback.get(key)
    if (memRaw !== null) {
      memoryFallback.delete(key)
      await redisDel(key)
      return parseRecord(memRaw)
    }
    const redisVal = await redisGetDel(key)
    if (typeof redisVal === 'string' && redisVal.length > 0) {
      return parseRecord(redisVal)
    }
    return null
  },

  async delete(jti: string): Promise<void> {
    const key = buildKey(jti)
    memoryFallback.delete(key)
    await redisDel(key)
  },

  async resetForTest(): Promise<void> {
    memoryFallback.clearAll()
    await redisClearAll()
  },
}

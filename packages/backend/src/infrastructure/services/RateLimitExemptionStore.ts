/**
 * 豁免存储：Redis 优先、内存回退（PRD §8.7 冻结，Q5 已落实）
 * - key 含 IP 归一化（复用 ipKeyGenerator）+ jti：ratelimit:exempt:<normIp>:<jti>
 * - TTL = 签发时 exemptionMinutes 快照（test 下 TEST_EXEMPT_SEC 秒级）
 * - 未命中/过期/跨实例按真值表统一 429；存储异常 fail-closed（返回 false，不得抛 500）
 * - 内存回退下豁免粘滞单实例（文档声明；随后 20 次全过仅单实例/粘性路由成立）
 */
import { ipKeyGenerator } from 'express-rate-limit'
import { redis } from '../../lib/redis'

const KEY_PREFIX = 'ratelimit:exempt:'

function normalizeIp(ip: string): string {
  try {
    return ipKeyGenerator(ip)
  } catch {
    return ip
  }
}

function buildKey(ip: string, jti: string): string {
  return `${KEY_PREFIX}${normalizeIp(ip)}:${jti}`
}

function keyBelongsToIp(key: string, ip: string): boolean {
  return (
    key === `${KEY_PREFIX}${normalizeIp(ip)}:` || key.startsWith(`${KEY_PREFIX}${normalizeIp(ip)}:`)
  )
}

type MemoryEntry = { expiresAt: number }

class MemoryFallback {
  private data = new Map<string, MemoryEntry>()

  set(key: string, ttlSec: number): void {
    this.data.set(key, { expiresAt: Date.now() + ttlSec * 1000 })
  }

  has(key: string): boolean {
    const entry = this.data.get(key)
    if (!entry) return false
    if (Date.now() >= entry.expiresAt) {
      this.data.delete(key)
      return false
    }
    return true
  }

  delete(key: string): void {
    this.data.delete(key)
  }

  deleteByIp(ip: string): void {
    for (const key of [...this.data.keys()]) {
      if (keyBelongsToIp(key, ip)) this.data.delete(key)
    }
  }
}

const memoryFallback = new MemoryFallback()

async function redisSetEx(key: string, ttlSec: number): Promise<boolean> {
  try {
    const client = redis as unknown as {
      set?: (k: string, v: string, mode?: string, dur?: number) => Promise<unknown>
    }
    if (!client || typeof client.set !== 'function') return false
    await client.set(key, '1', 'EX', Math.max(1, Math.floor(ttlSec)))
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

async function redisDelByIp(ip: string): Promise<void> {
  try {
    const client = redis as unknown as {
      keys?: (p: string) => Promise<string[]>
      del?: (...keys: string[]) => Promise<unknown>
    }
    if (!client || typeof client.keys !== 'function' || typeof client.del !== 'function') return
    const pattern = `${KEY_PREFIX}${normalizeIp(ip)}:*`
    const keys = await client.keys(pattern)
    if (keys && keys.length > 0) await client.del(...keys)
  } catch {
    // fail-closed：忽略
  }
}

export const rateLimitExemptionStore = {
  buildKey,

  async save(ip: string, jti: string, ttlSec: number): Promise<void> {
    const key = buildKey(ip, jti)
    const ttl = Math.max(1, Math.floor(ttlSec))
    const ok = await redisSetEx(key, ttl)
    // 双写内存回退：Redis 不可用时仍可用；Redis 可用时内存作为同 TTL 镜像（单实例粘滞声明不变）
    memoryFallback.set(key, ttl)
    if (!ok) {
      // 已落内存，fail-closed 不抛
    }
  },

  /** AND 真值表之“服务端记录有效”：签名/IP 通过后仍以此为准 */
  async has(ip: string, jti: string): Promise<boolean> {
    const key = buildKey(ip, jti)
    const redisVal = await redisGet(key)
    if (redisVal === '1') return true
    if (redisVal === null) {
      // Redis 明确未命中 → 再看内存镜像（回退写入的记录仍有效）
      return memoryFallback.has(key)
    }
    // redisVal === undefined（异常/无客户端）→ 以内存为准，fail-closed（无记录即 false）
    return memoryFallback.has(key)
  },

  async deleteByIp(ip: string): Promise<void> {
    await redisDelByIp(ip)
    memoryFallback.deleteByIp(ip)
  },

  /** 单测隔离：清调用方 IP 全部豁免 */
  async resetForTest(ip: string): Promise<void> {
    await this.deleteByIp(ip)
  },
}

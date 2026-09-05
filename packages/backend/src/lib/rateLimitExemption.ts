/**
 * 豁免判定辅助（B3）：内网 IP 判断 + 测试覆盖读取
 * DDD：纯函数，无副作用，供 lib/rateLimit.ts 的 skip 使用
 */
import type { Request } from 'express'

export function getTestReadMax(): number | null {
  const raw = process.env.TEST_READ_MAX
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 1000) return null
  return n
}

export function getTestReadWindowSec(): number | null {
  const raw = process.env.TEST_READ_WINDOW_SEC
  if (!raw) return null
  const n = Number(raw)
  if (![10, 30, 60, 300, 600].includes(n)) return null
  return n
}

export function hasTestResetHeader(req: Request): boolean {
  const v = req.headers['x-test-reset-ratelimit']
  if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true'
  if (Array.isArray(v)) return v.some((x) => x === '1' || String(x).toLowerCase() === 'true')
  return false
}

export function hasFederalTestResetHeader(req: Request): boolean {
  const v = req.headers['x-test-reset-federal']
  if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true'
  if (Array.isArray(v)) return v.some((x) => x === '1' || String(x).toLowerCase() === 'true')
  return false
}

/**
 * 容器内网 IP（F3 冻结）：作为 getClientIp 结果时不豁免、直接计数
 * 10.0.0.0/8、172.16.0.0/12、192.168.0.0/16、127.0.0.0/8、::1、fc00::/7、fe80::/10
 */
export function isIntranetIp(ip: string): boolean {
  if (!ip || ip === 'unknown') return true
  let v = ip.trim().toLowerCase()
  // ipKeyGenerator 对 IPv6 可能返回 subnet（如 2001:db8::/56），取 / 前部分判定
  const slash = v.indexOf('/')
  if (slash >= 0) v = v.slice(0, slash)
  // 去掉方括号（如 [::1]）
  if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1)

  if (v === '::1' || v === '::ffff:127.0.0.1') return true
  // IPv4（含 IPv4-mapped IPv6 ::ffff:a.b.c.d）
  const mapped = v.startsWith('::ffff:') ? v.slice('::ffff:'.length) : v
  const parts = mapped.split('.')
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const nums = parts.map((p) => Number(p))
    if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
    const [a, b] = nums as [number, number, number, number]
    if (a === 10) return true
    if (a === 127) return true
    if (a === 192 && b === 168) return true
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true
    return false
  }
  // IPv6 ULA fc00::/7（fcxx/fdxx）与链路本地 fe80::/10（fe80–febf）
  if (v.includes(':')) {
    if (v === '::1') return true
    if (v.startsWith('fc') || v.startsWith('fd')) return true
    if (
      v.startsWith('fe80') ||
      v.startsWith('fe81') ||
      v.startsWith('fe82') ||
      v.startsWith('fe83') ||
      v.startsWith('fe84') ||
      v.startsWith('fe85') ||
      v.startsWith('fe86') ||
      v.startsWith('fe87') ||
      v.startsWith('fe88') ||
      v.startsWith('fe89') ||
      v.startsWith('fe8a') ||
      v.startsWith('fe8b') ||
      v.startsWith('fe8c') ||
      v.startsWith('fe8d') ||
      v.startsWith('fe8e') ||
      v.startsWith('fe8f') ||
      v.startsWith('fe9') ||
      v.startsWith('fea') ||
      v.startsWith('feb')
    )
      return true
    return false
  }
  return false
}

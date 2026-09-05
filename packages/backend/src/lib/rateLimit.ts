/**
 * 模块：Rate Limit
 *
 * 函数作用：
 *   请求频率限制工具——提供客户端 IP 提取函数和各场景的频率限制器。
 *   B3/B4/B5（API-SPEC v1.0.2 + PRD v1.1.1）：
 *   - getClientIp 优先级冻结（F3）：X-Forwarded-For 首 IP（trim，经 ipKeyGenerator）若存在且非空 → req.ip/socket 回退
 *   - publicReadLimiter 动态化（管理 max/windowSec + TEST 覆盖）+ skip 豁免判定（AND 真值表）+ 定制 429 体
 *   - unlockLimiter 独立 10次/15分钟/IP（与 captchaLimiter 独立；不叠加 authLimiter 由路由挂载保证）
 *   - X-Test-Reset-RateLimit（test 清桶，生产 404）
 * 禁区：写限流（post/upload/friend/report/login/register/2FA）与 searchLimiter 零变更（除 getClientIp 全局 F3 优先级）。
 */
import { NextFunction, Request, Response } from 'express'
import { rateLimit, ipKeyGenerator, type RateLimitRequestHandler } from 'express-rate-limit'
import {
  getTestReadMax,
  getTestReadWindowSec,
  hasTestResetHeader,
  isIntranetIp,
} from './rateLimitExemption'
import { verifyUnlockToken } from './unlockToken'
import { rateLimitExemptionStore } from '../infrastructure/services/RateLimitExemptionStore'
import {
  DEFAULT_RATE_LIMIT_PROTECTION_POLICY,
  type RateLimitProtectionPolicy,
} from '../domain/system/RateLimitProtection'
import { PrismaSitePolicyRepository } from '../infrastructure/repositories/PrismaSitePolicyRepository'
import { RateLimitProtectionService } from '../application/system/RateLimitProtectionService'

/**
 * 函数名称：getClientIp
 *
 * F3 冻结优先级：
 *   1) X-Forwarded-For 首 IP（逗号分隔取第 1 段 trim，经 ipKeyGenerator 规范化），若存在且非空
 *   2) req.ip / socket.remoteAddress 回退
 * trust proxy=1 不变（仅信任直连对端=前端容器，禁止全信任）。
 */
export const getClientIp = (req: Request): string => {
  try {
    const rawXff = (req.headers as Record<string, unknown>)['x-forwarded-for']
    let first: string | null = null
    if (typeof rawXff === 'string' && rawXff.trim().length > 0) {
      const seg = rawXff.split(',')[0]
      if (seg && seg.trim().length > 0) first = seg.trim()
    } else if (Array.isArray(rawXff) && rawXff.length > 0) {
      const head = rawXff[0]
      if (typeof head === 'string') {
        const seg = head.split(',')[0]
        if (seg && seg.trim().length > 0) first = seg.trim()
      }
    }
    if (first) {
      try {
        return ipKeyGenerator(first)
      } catch {
        return first
      }
    }
  } catch {
    // 回退
  }
  const fallback = (req as { ip?: string }).ip || req.socket?.remoteAddress || 'unknown'
  try {
    return ipKeyGenerator(fallback)
  } catch {
    return fallback
  }
}

// ── 读配置安全读取（fail-closed 回默认；测试 TTL=0 由 Service 内部处理） ──

let protectionServiceSingleton: RateLimitProtectionService | null = null
function getProtectionService(): RateLimitProtectionService {
  if (!protectionServiceSingleton) {
    protectionServiceSingleton = new RateLimitProtectionService({
      sitePolicyRepository: new PrismaSitePolicyRepository(),
    })
  }
  return protectionServiceSingleton
}

async function getPolicySafe(): Promise<RateLimitProtectionPolicy> {
  try {
    return await getProtectionService().getPolicy()
  } catch {
    return { ...DEFAULT_RATE_LIMIT_PROTECTION_POLICY }
  }
}

async function getEffectiveReadMax(): Promise<number> {
  const testMax = getTestReadMax()
  if (testMax !== null && process.env.NODE_ENV === 'test') return testMax
  // 非 test 下 TEST_* 忽略（生产不可达）
  const policy = await getPolicySafe()
  return policy.publicReadMax
}

async function getEffectiveWindowSec(): Promise<number> {
  const testWindow = getTestReadWindowSec()
  if (testWindow !== null && process.env.NODE_ENV === 'test') return testWindow
  const policy = await getPolicySafe()
  return policy.windowSec
}

// ── 写限流（零变更；仅 getClientIp 全局 F3 优先级影响 key） ──

export const postLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'Too many posts or comments from this IP, please try again later.' },
})

export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'Too many uploads from this IP, please try again later.' },
})

export const friendRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'Too many friend requests from this IP, please try again later.' },
})

export const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'Too many reports from this IP, please try again later.' },
})

// ── B3 豁免判定（AND 真值表） ──

async function shouldSkipPublicRead(req: Request): Promise<boolean> {
  try {
    // 测试清桶请求的当次跳过由外层 wrapper 直接 next() 旁路，此处兜底
    if ((req as unknown as Record<string, unknown>)._testResetSkipped === true) return true
    const policy = await getPolicySafe()
    // 总开关关闭时不限流（v1 默认启用；关闭语义另行冻结，此处按旁路实现）
    if (policy.enabled === false) return true
    const ip = getClientIp(req)
    // 容器内网 IP 不豁免、直接计数
    if (isIntranetIp(ip)) return false
    const raw = req.headers['x-ratelimit-unlock']
    const token = Array.isArray(raw) ? raw[0] : raw
    if (typeof token !== 'string' || token.length === 0) return false
    const payload = verifyUnlockToken(token)
    if (!payload) return false
    if (payload.ip !== ip) return false
    return await rateLimitExemptionStore.has(ip, payload.jti)
  } catch {
    // 存储异常 fail-closed：正常计数，不得抛 500
    return false
  }
}

function calcRetryAfterSec(req: Request, fallbackWindowSec: number): number {
  try {
    const info = (req as unknown as { rateLimit?: { resetTime?: Date | number } }).rateLimit
    const reset = info?.resetTime
    const resetMs =
      reset instanceof Date ? reset.getTime() : typeof reset === 'number' ? reset : null
    if (resetMs !== null && Number.isFinite(resetMs)) {
      return Math.max(1, Math.ceil((resetMs - Date.now()) / 1000))
    }
  } catch {
    // ignore
  }
  return Math.max(1, fallbackWindowSec)
}

const UNLOCK_ENDPOINT = '/api/v1/auth/captcha/unlock'

function publicReadExceededHandler(req: Request, res: Response): void {
  // 同步读取可用窗口（TEST 覆盖同步；异步策略回退 60s，保证 handler 不抛）
  const testWindow = process.env.NODE_ENV === 'test' ? getTestReadWindowSec() : null
  const fallback = testWindow ?? 60
  const retryAfterSec = calcRetryAfterSec(req, fallback)
  res.setHeader('Retry-After', String(retryAfterSec))
  res.status(429).json({
    error: 'ERR_RATE_LIMITED_NEEDS_CAPTCHA',
    unlockRequired: true,
    retryAfterSec,
    unlockEndpoint: UNLOCK_ENDPOINT,
  })
}

// ── B3 publicReadLimiter 动态化：按 windowSec 建 5 个底层 limiter，运行时按有效窗口委派 ──

const READ_WINDOW_CHOICES = [10, 30, 60, 300, 600] as const
const underlyingReadLimiters = new Map<number, RateLimitRequestHandler>()

function getUnderlyingReadLimiter(windowSec: number): RateLimitRequestHandler {
  const key = (READ_WINDOW_CHOICES as readonly number[]).includes(windowSec) ? windowSec : 60
  const cached = underlyingReadLimiters.get(key)
  if (cached) return cached
  const limiter = rateLimit({
    windowMs: key * 1000,
    // 动态 max：TEST 覆盖 / 策略快照（limit 支持 async 函数）
    limit: async () => getEffectiveReadMax(),
    max: async () => getEffectiveReadMax(),
    keyGenerator: getClientIp,
    validate: { ip: false, xForwardedForHeader: false },
    skip: async (req) => shouldSkipPublicRead(req as Request),
    handler: (req, res) => publicReadExceededHandler(req as Request, res as Response),
  })
  underlyingReadLimiters.set(key, limiter)
  return limiter
}

async function resetPublicReadForTest(ip: string): Promise<void> {
  for (const limiter of underlyingReadLimiters.values()) {
    try {
      await limiter.resetKey(ip)
    } catch {
      // ignore
    }
  }
  // 尚未建实例的窗口也尝试建后清（保证隔离）
  for (const w of READ_WINDOW_CHOICES) {
    try {
      await getUnderlyingReadLimiter(w).resetKey(ip)
    } catch {
      // ignore
    }
  }
  try {
    await rateLimitExemptionStore.resetForTest(ip)
  } catch {
    // ignore
  }
}

type PublicReadLimiter = ((req: Request, res: Response, next: NextFunction) => Promise<void>) & {
  resetKey: (key: string) => Promise<void>
  getKey: (key: string) => Promise<{ totalHits: number; resetTime: Date | undefined } | undefined>
}

const publicReadLimiterFn = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  // B5 测试钩子：X-Test-Reset-RateLimit（生产 404 隐藏语义）
  if (hasTestResetHeader(req)) {
    if (process.env.NODE_ENV !== 'test') {
      res.status(404).json({ success: false, error: 'ERR_NOT_FOUND' })
      return
    }
    try {
      const ip = getClientIp(req)
      await resetPublicReadForTest(ip)
    } catch {
      // ignore
    }
    // 清桶当次旁路计数（隔离用），直接放行到业务
    next()
    return
  }
  const windowSec = await getEffectiveWindowSec()
  const limiter = getUnderlyingReadLimiter(windowSec)
  await limiter(req, res, next)
  return
}

export const publicReadLimiter = Object.assign(publicReadLimiterFn, {
  resetKey: async (key: string): Promise<void> => {
    await resetPublicReadForTest(key)
  },
  getKey: async (
    key: string,
  ): Promise<{ totalHits: number; resetTime: Date | undefined } | undefined> => {
    // 依次查询各窗口实例，返回首个命中
    for (const w of READ_WINDOW_CHOICES) {
      try {
        const info = await getUnderlyingReadLimiter(w).getKey(key)
        if (info) return info as { totalHits: number; resetTime: Date | undefined }
      } catch {
        // ignore
      }
    }
    return undefined
  },
}) as PublicReadLimiter

// searchLimiter v1 不联动，保持旧 429 语义（零变更；仅 getClientIp F3 优先级）

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'Too many search requests from this IP, please try again later.' },
})

// ── B2 unlockLimiter 独立 10次/15分钟/IP（与 captchaLimiter 独立；路由层保证不叠加 authLimiter） ──

function unlockExceededHandler(req: Request, res: Response): void {
  const retryAfterSec = calcRetryAfterSec(req, 15 * 60)
  res.setHeader('Retry-After', String(retryAfterSec))
  // 通用限流体，不用 ERR_RATE_LIMITED_NEEDS_CAPTCHA，不含 unlockRequired
  res.status(429).json({ success: false, error: 'ERR_RATE_LIMITED', retryAfterSec })
}

export const unlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  limit: 10,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  handler: (req, res) => unlockExceededHandler(req as Request, res as Response),
})

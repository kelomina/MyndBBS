/**
 * 控制器：RateLimitProtection（读限流与解锁配置，B4）
 *
 * - GET/PUT /api/admin/protection/rate-limit（ADMIN+：requireAuthHidden + adminLimiter + requireAbility('manage','all') 由路由层保证）
 * - 匿名 404（requireAuthHidden）；MODERATOR 读写 403（requireAbility）；ADMIN/SUPER_ADMIN 可读（casl manage all）
 * - PUT zod 严格模式（禁止 coerce；"30"→400、缺字段→400、未知字段→400、无 clamp）；越界 400 旧值不变、不部分更新
 * - PUT 成功显式 logAudit（操作者 userId、请求 IP、前后 diff、时间）；审计经 GET /api/admin/audit-logs 可查
 * - 持久化 SitePolicy key=rate_limit_unlock + 60s 读缓存（test 下 TTL=0 即时生效，由 Service 内部处理）
 */
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { rateLimitProtectionService, auditApplicationService } from '../registry'
import { rateLimitProtectionSchema } from '../lib/validation/schemas'
import { getClientIp } from '../lib/rateLimit'
import type { RateLimitProtectionPolicy } from '../domain/system/RateLimitProtection'

function diffPolicy(
  before: RateLimitProtectionPolicy,
  after: RateLimitProtectionPolicy,
): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {}
  const keys = [
    'enabled',
    'publicReadMax',
    'windowSec',
    'captchaStrength',
    'exemptionMinutes',
    'exemptionScope',
    'loginRelaxed',
  ] as const
  for (const k of keys) {
    if (before[k] !== after[k]) {
      diff[k] = { before: before[k], after: after[k] }
    }
  }
  return diff
}

export const getRateLimitProtection = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const policy = await rateLimitProtectionService.getPolicy()
    res.json({ ...policy })
  } catch (error) {
    console.error('[rateLimitProtection] get failed:', error)
    res.status(500).json({ success: false, error: 'ERR_INTERNAL_SERVER_ERROR' })
  }
}

export const updateRateLimitProtection = async (req: AuthRequest, res: Response): Promise<void> => {
  let before: RateLimitProtectionPolicy
  try {
    before = await rateLimitProtectionService.getPolicy()
  } catch (error) {
    console.error('[rateLimitProtection] read before failed:', error)
    res.status(500).json({ success: false, error: 'ERR_INTERNAL_SERVER_ERROR' })
    return
  }

  // G2 strict：zod 严格模式，禁止 coerce；任一字段非法/缺字段/未知字段→400 且旧值不变
  const parsed = rateLimitProtectionSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    const detail = firstIssue
      ? `${String(firstIssue.path.join('.') || '_root')}: ${firstIssue.message}`
      : 'invalid policy'
    res.status(400).json({ success: false, error: 'ERR_INVALID_RATE_LIMIT_POLICY', detail })
    return
  }

  const next: RateLimitProtectionPolicy = {
    enabled: parsed.data.enabled,
    publicReadMax: parsed.data.publicReadMax,
    windowSec: parsed.data.windowSec,
    captchaStrength: parsed.data.captchaStrength,
    exemptionMinutes: parsed.data.exemptionMinutes,
    exemptionScope: parsed.data.exemptionScope,
    loginRelaxed: parsed.data.loginRelaxed,
  }

  try {
    const policy = await rateLimitProtectionService.replacePolicy(next)
    // PUT 成功显式 logAudit（操作者/IP/前后 diff/时间）
    try {
      const operatorId = req.user?.userId ?? 'unknown'
      const ip = getClientIp(req as unknown as Parameters<typeof getClientIp>[0])
      const diff = diffPolicy(before, policy)
      await auditApplicationService.logAudit(
        operatorId,
        'UPDATE_RATE_LIMIT_POLICY',
        'RateLimitPolicy',
        'SYSTEM',
        req.originalUrl || '/api/admin/protection/rate-limit',
        ip,
        { before, after: policy, diff, at: new Date().toISOString() },
      )
    } catch (auditError) {
      console.error('[rateLimitProtection] audit failed (non-blocking):', auditError)
    }
    res.json({ message: 'RATE_LIMIT_POLICY_UPDATED', policy })
  } catch (error) {
    console.error('[rateLimitProtection] update failed:', error)
    res.status(500).json({ success: false, error: 'ERR_INTERNAL_SERVER_ERROR' })
  }
}

/**
 * 控制器：FederalProtection（联邦验证管理配置）
 *
 * - GET/PUT /api/admin/protection/federal（ADMIN+：requireAuthHidden + adminLimiter + requireAbility('manage','all') 由路由层保证）
 * - 匿名 404（requireAuthHidden）；MODERATOR 读写 403（requireAbility）；ADMIN/SUPER_ADMIN 可读写
 * - PUT zod 严格模式（禁止 coerce；"16"→400、除 strictTimeoutSec 可选缺省 15 外缺字段→400、未知字段→400、全关→400、defaultKind 指已关→400、无 clamp；strictTimeoutSec 传了仍按 5–60 校验，缺省默认 15；GET 回显恒含该字段）
 * - PUT 成功显式 logAudit（操作者 userId、请求 IP、前后 diff、时间）；审计经 GET /api/admin/audit-logs 可查
 * - 持久化 SitePolicy key=captcha_federal + 60s 读缓存（test 下 TTL=0 即时生效，由 Service 内部处理）
 */
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { federalProtectionService, auditApplicationService } from '../registry'
import { federalProtectionSchema } from '../lib/validation/schemas'
import { getClientIp } from '../lib/rateLimit'
import type { FederalProtectionPolicy } from '../domain/system/FederalProtection'

function diffPolicy(
  before: FederalProtectionPolicy,
  after: FederalProtectionPolicy,
): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {}
  const keys = [
    'enabled',
    'kinds',
    'defaultKind',
    'powBits',
    'geometryLevel',
    'timeoutSec',
    'strictTimeoutSec',
  ] as const
  for (const k of keys) {
    const b = before[k]
    const a = after[k]
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      diff[k] = { before: b, after: a }
    }
  }
  return diff
}

export const getFederalProtection = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const policy = await federalProtectionService.getPolicy()
    res.json({ ...policy })
  } catch (error) {
    console.error('[federalProtection] get failed:', error)
    res.status(500).json({ success: false, error: 'ERR_INTERNAL_SERVER_ERROR' })
  }
}

export const updateFederalProtection = async (req: AuthRequest, res: Response): Promise<void> => {
  let before: FederalProtectionPolicy
  try {
    before = await federalProtectionService.getPolicy()
  } catch (error) {
    console.error('[federalProtection] read before failed:', error)
    res.status(500).json({ success: false, error: 'ERR_INTERNAL_SERVER_ERROR' })
    return
  }

  // G2 strict：zod 严格模式，禁止 coerce；除 strictTimeoutSec 可选缺省 15 外，任一字段非法/缺字段/未知字段/全关/defaultKind 指已关→400 且旧值不变（strictTimeoutSec 传了仍按 5–60 校验）
  const parsed = federalProtectionSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    const detail = firstIssue
      ? `${String(firstIssue.path.join('.') || '_root')}: ${firstIssue.message}`
      : 'invalid policy'
    res.status(400).json({ success: false, error: 'ERR_INVALID_FEDERAL_POLICY', detail })
    return
  }

  const next: FederalProtectionPolicy = {
    enabled: parsed.data.enabled,
    kinds: {
      sliderEnabled: parsed.data.kinds.sliderEnabled,
      geometryEnabled: parsed.data.kinds.geometryEnabled,
      powEnabled: parsed.data.kinds.powEnabled,
    },
    defaultKind: parsed.data.defaultKind,
    powBits: parsed.data.powBits,
    geometryLevel: parsed.data.geometryLevel,
    timeoutSec: parsed.data.timeoutSec,
    strictTimeoutSec: parsed.data.strictTimeoutSec,
  }

  try {
    const policy = await federalProtectionService.replacePolicy(next)
    // PUT 成功显式 logAudit（操作者/IP/前后 diff/时间）
    try {
      const operatorId = req.user?.userId ?? 'unknown'
      const ip = getClientIp(req as unknown as Parameters<typeof getClientIp>[0])
      const diff = diffPolicy(before, policy)
      await auditApplicationService.logAudit(
        operatorId,
        'UPDATE_FEDERAL_POLICY',
        'FederalPolicy',
        'SYSTEM',
        req.originalUrl || '/api/admin/protection/federal',
        ip,
        { before, after: policy, diff, at: new Date().toISOString() },
      )
    } catch (auditError) {
      console.error('[federalProtection] audit failed (non-blocking):', auditError)
    }
    res.json({ message: 'FEDERAL_POLICY_UPDATED', policy })
  } catch (error) {
    console.error('[federalProtection] update failed:', error)
    res.status(500).json({ success: false, error: 'ERR_INTERNAL_SERVER_ERROR' })
  }
}

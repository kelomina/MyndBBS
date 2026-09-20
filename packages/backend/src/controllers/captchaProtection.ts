import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { auditApplicationService, captchaProtectionService } from '../registry'
import { captchaProtectionSchema } from '../lib/validation/schemas'
import { getClientIp } from '../lib/rateLimit'
import type { CaptchaProtectionPolicy } from '../domain/system/CaptchaProtection'

function diffPolicy(before: CaptchaProtectionPolicy, after: CaptchaProtectionPolicy) {
  return {
    enabled: before.enabled === after.enabled ? undefined : { before: before.enabled, after: after.enabled },
    surfaces:
      JSON.stringify(before.surfaces) === JSON.stringify(after.surfaces)
        ? undefined
        : { before: before.surfaces, after: after.surfaces },
  }
}

export const getCaptchaProtection = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await captchaProtectionService.getPolicy())
  } catch (error) {
    console.error('[captchaProtection] get failed:', error)
    res.status(500).json({ success: false, error: 'ERR_INTERNAL_SERVER_ERROR' })
  }
}

export const updateCaptchaProtection = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = captchaProtectionSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    res.status(400).json({
      success: false,
      error: 'ERR_INVALID_CAPTCHA_PROTECTION_POLICY',
      detail: firstIssue ? `${String(firstIssue.path.join('.') || '_root')}: ${firstIssue.message}` : 'invalid policy',
    })
    return
  }

  try {
    const before = await captchaProtectionService.getPolicy()
    const policy = await captchaProtectionService.replacePolicy(parsed.data)
    try {
      await auditApplicationService.logAudit(
        req.user?.userId ?? 'unknown',
        'UPDATE_CAPTCHA_POLICY',
        'CaptchaProtectionPolicy',
        'SYSTEM',
        req.originalUrl || '/api/admin/protection/captcha',
        getClientIp(req as Parameters<typeof getClientIp>[0]),
        { before, after: policy, diff: diffPolicy(before, policy), at: new Date().toISOString() },
      )
    } catch (auditError) {
      console.error('[captchaProtection] audit failed (non-blocking):', auditError)
    }
    res.json({ message: 'CAPTCHA_POLICY_UPDATED', policy })
  } catch (error) {
    console.error('[captchaProtection] update failed:', error)
    res.status(500).json({ success: false, error: 'ERR_INTERNAL_SERVER_ERROR' })
  }
}

/** 公共入口只读策略；任何存储/解析异常均按需要验证返回，避免故障绕过保护。 */
export const getCaptchaRequirements = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const policy = await captchaProtectionService.getPolicy()
    res.json({
      registration: policy.enabled && policy.surfaces.registration,
      post: policy.enabled && policy.surfaces.post,
      comment: policy.enabled && policy.surfaces.comment,
      friendRequest: policy.enabled && policy.surfaces.friendRequest,
    })
  } catch (error) {
    console.error('[captchaProtection] requirements failed closed:', error)
    res.json({ registration: true, post: true, comment: true, friendRequest: true })
  }
}

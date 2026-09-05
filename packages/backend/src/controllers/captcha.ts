import { Request, Response } from 'express'
import { authApplicationService, rateLimitProtectionService } from '../registry'
import { getClientIp } from '../lib/rateLimit'
import { signUnlockToken, getExemptTtlSec } from '../lib/unlockToken'
import { rateLimitExemptionStore } from '../infrastructure/services/RateLimitExemptionStore'
import { DEFAULT_RATE_LIMIT_PROTECTION_POLICY } from '../domain/system/RateLimitProtection'

const CAPTCHA_VERIFICATION_FAILED_ERROR = 'ERR_VERIFICATION_FAILED'

function respondWithPublicCaptchaFailure(
  req: Request,
  res: Response,
  internalErrorCode: string,
): void {
  console.warn('[Captcha] Verification failed', {
    internalErrorCode,
    captchaId: typeof req.body?.captchaId === 'string' ? req.body.captchaId : undefined,
  })
  res.status(400).json({ success: false, error: CAPTCHA_VERIFICATION_FAILED_ERROR })
}

/**
 * 函数名称：generateCaptcha
 *
 * 函数作用：
 *   生成滑块验证码挑战——生成随机目标位置，返回 SVG 图片和验证码 ID。
 * Purpose:
 *   Generates a slider captcha challenge — creates a random target position,
 *   returns an SVG image and captcha ID.
 *
 * 调用方 / Called by:
 *   GET /api/v1/auth/captcha
 *
 * 被调用方 / Calls:
 *   - authApplicationService.generateCaptcha
 *
 * 参数说明 / Parameters:
 *   无
 *
 * 返回值说明 / Returns:
 *   200: { captchaId: string, image: string } 验证码 ID 和 SVG 图片
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   500: ERR_FAILED_TO_GENERATE_CAPTCHA
 *
 * 副作用 / Side effects:
 *   写数据库——创建 CaptchaChallenge 记录
 *
 * 中文关键词：
 *   验证码，滑块验证，SVG，人机校验
 * English keywords:
 *   captcha, slider verification, SVG, bot detection
 */
export const generateCaptcha = async (req: Request, res: Response) => {
  try {
    // B5 固定解（仅 test）：GET /captcha?testFixed=1 下发确定性挑战（target 取 TEST_CAPTCHA_TARGET 默认 120）
    // 生产不可达：非 test 下 testFixed 参数忽略
    if (
      process.env.NODE_ENV === 'test' &&
      (req.query as Record<string, unknown>).testFixed === '1'
    ) {
      const rawTarget = process.env.TEST_CAPTCHA_TARGET
      const parsed = rawTarget ? Number(rawTarget) : 120
      const target = Number.isInteger(parsed) && parsed >= 0 && parsed <= 1000 ? parsed : 120
      const { id, image } = await authApplicationService.generateFixedCaptcha(target)
      res.json({ captchaId: id, image })
      return
    }
    // B1 强度快照：按当前管理配置 captchaStrength 生成（默认 low）；管理切档仅新挑战生效
    let strength: 'low' | 'normal' | 'strict' = 'low'
    try {
      const policy = await rateLimitProtectionService.getPolicy()
      if (
        policy.captchaStrength === 'low' ||
        policy.captchaStrength === 'normal' ||
        policy.captchaStrength === 'strict'
      ) {
        strength = policy.captchaStrength
      }
    } catch {
      strength = DEFAULT_RATE_LIMIT_PROTECTION_POLICY.captchaStrength
    }
    const { id, image } = await authApplicationService.generateCaptcha(strength)
    res.json({ captchaId: id, image })
  } catch (error) {
    console.error('Error generating captcha:', error)
    res.status(500).json({ error: 'ERR_FAILED_TO_GENERATE_CAPTCHA' })
  }
}

/**
 * 函数名称：verifyCaptcha
 *
 * 函数作用：
 *   验证滑块验证码——校验用户的拖拽轨迹、总拖拽时间和最终位置。
 * Purpose:
 *   Verifies a slider captcha — validates the user's drag trajectory, total drag time, and final position.
 *
 * 调用方 / Called by:
 *   POST /api/v1/auth/captcha/verify
 *
 * 被调用方 / Calls:
 *   - authApplicationService.verifyCaptcha
 *
 * 参数说明 / Parameters:
 *   - req.body.captchaId: string, 验证码 ID
 *   - req.body.dragPath: array, 拖拽路径点数组 [{x, y, time}]
 *   - req.body.totalDragTime: number, 总拖拽时间（毫秒）
 *   - req.body.finalPosition: number, 最终滑块位置
 *
 * 返回值说明 / Returns:
 *   200: { success: true, message: string }
 *   400: { success: false, error: ERR_VERIFICATION_FAILED }
 *   500: { success: false, error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 400: ERR_VERIFICATION_FAILED（对外统一返回，内部日志记录真实原因）
 *   - 500: ERR_SERVER_ERROR_DURING_VERIFICATION
 *
 * 副作用 / Side effects:
 *   写数据库——更新验证码状态为已验证
 *
 * 中文关键词：
 *   验证码，滑块验证，轨迹校验，人机验证
 * English keywords:
 *   captcha, slider verification, trajectory validation, bot detection
 */
export const verifyCaptcha = async (req: Request, res: Response): Promise<void> => {
  try {
    const { captchaId, dragPath, totalDragTime, finalPosition } = req.body

    if (
      typeof captchaId !== 'string' ||
      captchaId.length === 0 ||
      !Array.isArray(dragPath) ||
      typeof totalDragTime !== 'number' ||
      typeof finalPosition !== 'number'
    ) {
      respondWithPublicCaptchaFailure(req, res, 'ERR_INVALID_CAPTCHA_VERIFICATION_REQUEST')
      return
    }

    // Map frontend 'time' to domain 't'（兼容 {x,y,t} 与 {x,y,time} 两种形状）
    const formattedDragPath = dragPath.map((p: any) => ({ x: p?.x, y: p?.y, t: p?.t ?? p?.time }))

    await authApplicationService.verifyCaptcha(
      captchaId,
      formattedDragPath,
      totalDragTime,
      finalPosition,
    )

    res.json({ success: true, message: 'Verification passed' })
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith('ERR_')) {
      respondWithPublicCaptchaFailure(req, res, error.message)
      return
    }
    console.error('[Captcha] Unexpected verification error:', error)
    res.status(500).json({ success: false, error: 'ERR_SERVER_ERROR_DURING_VERIFICATION' })
  }
}

/**
 * B2 解锁兑换：POST /api/v1/auth/captcha/unlock（匿名可用）
 * - 入参 {captchaId, dragPath, totalDragTime, finalPosition}（验证入参；内部 verify+consume，不依赖外部 verify 标记）
 * - captchaId 原子消费一次一用，与发帖/评论/注册 consume 互斥先到先得；二次/并发双兑统一 400 ERR_VERIFICATION_FAILED
 * - 强度按生成时快照判定；成功签发 unlockToken（typ=ratelimit-unlock+ip+jti+exp=strength快照+签发时exemptionMinutes快照）+ 服务端豁免记录
 * - 兑换超限由独立 unlockLimiter 429（通用体，不用解锁 429 体）；此处只处理验证/消费/签发
 */
export const unlockCaptcha = async (req: Request, res: Response): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>
  const captchaId = body.captchaId
  const dragPath = body.dragPath
  const totalDragTime = body.totalDragTime
  const finalPosition = body.finalPosition

  if (
    typeof captchaId !== 'string' ||
    captchaId.length === 0 ||
    !Array.isArray(dragPath) ||
    typeof totalDragTime !== 'number' ||
    typeof finalPosition !== 'number'
  ) {
    respondWithPublicCaptchaFailure(req, res, 'ERR_INVALID_UNLOCK_REQUEST')
    return
  }

  const formattedDragPath = (dragPath as any[]).map((p: any) => ({
    x: p?.x,
    y: p?.y,
    t: p?.t ?? p?.time,
  }))

  try {
    const { strength } = await authApplicationService.verifyAndConsumeForUnlock(
      captchaId,
      formattedDragPath,
      totalDragTime,
      finalPosition,
    )

    let exemptionMinutes = DEFAULT_RATE_LIMIT_PROTECTION_POLICY.exemptionMinutes
    try {
      const policy = await rateLimitProtectionService.getPolicy()
      exemptionMinutes = policy.exemptionMinutes
    } catch {
      exemptionMinutes = DEFAULT_RATE_LIMIT_PROTECTION_POLICY.exemptionMinutes
    }

    const ip = getClientIp(req)
    const { token, jti, expiresAt } = signUnlockToken({ ip, exemptionMinutes, strength })
    const ttlSec = getExemptTtlSec(exemptionMinutes)
    try {
      await rateLimitExemptionStore.save(ip, jti, ttlSec)
    } catch (error) {
      console.error('[Unlock] Exemption store save failed (fail-closed, still issue token):', error)
      // fail-closed：存储异常仍签发？按真值表服务端记录为准，无记录则后续判定 429；
      // 此处已尽力双写（Redis+内存），异常仅日志，不抛 500，保证兑换语义可测
    }

    console.warn('[Unlock] Exchange success', {
      ip,
      captchaId,
      jti,
      strength,
      exemptMinutes: exemptionMinutes,
    })
    res.json({
      unlockToken: token,
      exemptMinutes: exemptionMinutes,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error: unknown) {
    const internal = error instanceof Error ? error.message : String(error)
    // 二次/并发双兑、过期/不存在/轨迹失败一律统一 400（真实原因仅日志）
    console.warn('[Unlock] Exchange failed', {
      ip: (() => {
        try {
          return getClientIp(req)
        } catch {
          return 'unknown'
        }
      })(),
      captchaId: typeof captchaId === 'string' ? captchaId : undefined,
      internalErrorCode: internal.startsWith('ERR_') ? internal : 'ERR_UNLOCK_FAILED',
    })
    res.status(400).json({ success: false, error: CAPTCHA_VERIFICATION_FAILED_ERROR })
  }
}

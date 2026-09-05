/**
 * 控制器：FederalCaptcha（联邦验证颁发与校验）
 *
 * - POST /api/v1/auth/captcha/federal/issue（匿名，服务端权威选型，独立 federalIssueLimiter）
 * - POST /api/v1/auth/captcha/federal/verify（匿名，按 kind 判别联合，失败统一 ERR_VERIFICATION_FAILED）
 * - 强度正交：low/normal/strict 只管容差耗时方差，不管题型难度（bits/level）
 * - 超时回落 slider-low：后端 infra 失败/超时自动签发 slider-low 代替并打日志（federalFallback=true）
 * - 测试钩子：testFixedFederalGeometry/testFixedFederalPow（body.testFixed=1，仅 test）+ X-Test-Reset-Federal（test 清桶+清行，生产 404）
 */
import { Request, Response } from 'express'
import {
  authApplicationService,
  federalCaptchaService,
  federalProtectionService,
  rateLimitProtectionService,
} from '../registry'
import { getClientIp } from '../lib/rateLimit'
import { hasFederalTestResetHeader } from '../lib/rateLimitExemption'
import { resetFederalIssueForTest } from '../lib/rateLimit'
import {
  DEFAULT_FEDERAL_PROTECTION_POLICY,
  isKindEnabled,
  resolveEffectiveKind,
  type FederalKind,
} from '../domain/system/FederalProtection'
import { DEFAULT_RATE_LIMIT_PROTECTION_POLICY } from '../domain/system/RateLimitProtection'
import type { CaptchaStrength } from '../domain/identity/CaptchaChallenge'

const FEDERAL_FAILURE = 'ERR_VERIFICATION_FAILED'
const FEDERAL_EXPIRES_SEC = 300

function respondFederalFailure(req: Request, res: Response, internal: string): void {
  console.warn('[FederalCaptcha] Verification failed', {
    internalErrorCode: internal,
    captchaId:
      typeof (req.body as Record<string, unknown>)?.captchaId === 'string'
        ? (req.body as Record<string, unknown>).captchaId
        : undefined,
    kind:
      typeof (req.body as Record<string, unknown>)?.kind === 'string'
        ? (req.body as Record<string, unknown>).kind
        : undefined,
  })
  res.status(400).json({ success: false, error: FEDERAL_FAILURE })
}

function isFederalKindValue(value: unknown): value is FederalKind {
  return value === 'slider' || value === 'geometry' || value === 'pow'
}

function normalizeStrength(value: unknown): CaptchaStrength {
  if (value === 'low' || value === 'normal' || value === 'strict') return value
  return 'low'
}

async function getFederalPolicySafe(): Promise<typeof DEFAULT_FEDERAL_PROTECTION_POLICY> {
  try {
    return await federalProtectionService.getPolicy()
  } catch {
    return {
      ...DEFAULT_FEDERAL_PROTECTION_POLICY,
      kinds: { ...DEFAULT_FEDERAL_PROTECTION_POLICY.kinds },
    }
  }
}

async function getSliderStrengthSafe(): Promise<CaptchaStrength> {
  try {
    const policy = await rateLimitProtectionService.getPolicy()
    if (
      policy.captchaStrength === 'low' ||
      policy.captchaStrength === 'normal' ||
      policy.captchaStrength === 'strict'
    ) {
      return policy.captchaStrength
    }
  } catch {
    // ignore
  }
  return DEFAULT_RATE_LIMIT_PROTECTION_POLICY.captchaStrength
}

/** 后端 infra 失败降级：自动签发 slider-low 代替并打日志（federalFallback=true, fromKind, reason） */
async function fallbackSliderLow(res: Response, fromKind: string, reason: string): Promise<void> {
  try {
    const { id, image } = await federalCaptchaService.issueSlider('low')
    console.warn('[FederalCaptcha] Fallback to slider-low', {
      federalFallback: true,
      fromKind,
      reason,
    })
    res.json({
      captchaId: id,
      kind: 'slider',
      image,
      strength: 'low',
      expiresInSec: FEDERAL_EXPIRES_SEC,
    })
  } catch (fallbackError) {
    console.error('[FederalCaptcha] Fallback slider-low failed:', fallbackError)
    res.status(500).json({ success: false, error: 'ERR_FAILED_TO_GENERATE_CAPTCHA' })
  }
}

export const issueFederalCaptcha = async (req: Request, res: Response): Promise<void> => {
  // 测试钩子生产隐藏：X-Test-Reset-Federal 在 limiter 层已处理旁路/404；
  // 此处兜底：生产携此头直接 404（不得泄露测试面存在）
  if (hasFederalTestResetHeader(req) && process.env.NODE_ENV !== 'test') {
    res.status(404).json({ success: false, error: 'ERR_NOT_FOUND' })
    return
  }
  // 测试隔离：verify 附带清桶时 limiter 已旁路；issue 附带时亦需清行（limiter 层已清，此处复查一次幂等）
  if (hasFederalTestResetHeader(req) && process.env.NODE_ENV === 'test') {
    try {
      await resetFederalIssueForTest(getClientIp(req))
    } catch {
      // ignore
    }
  }

  const body = (req.body ?? {}) as Record<string, unknown>
  // 空体/非对象均视为 {}（不传 kind 按 effectiveKind 签发）
  const rawKind = body.kind
  let requestedKind: FederalKind | null = null
  if (rawKind !== undefined) {
    if (!isFederalKindValue(rawKind)) {
      respondFederalFailure(req, res, 'ERR_INVALID_KIND')
      return
    }
    requestedKind = rawKind
  }
  const testFixed =
    process.env.NODE_ENV === 'test' &&
    (body.testFixed === 1 || body.testFixed === '1' || body.testFixed === true)

  let policy = await getFederalPolicySafe()

  // 联邦总开关关闭 → 全回落 slider-low（kinds/defaultKind 保留但不生效）
  if (policy.enabled === false) {
    await fallbackSliderLow(res, requestedKind ?? 'effective', 'federal disabled')
    return
  }

  let effectiveKind: FederalKind | null = null
  if (requestedKind) {
    // 受限【换一种】hint：指向已关类型 →400 统一码（不回落，防 farming 挑最易题）
    if (!isKindEnabled(policy, requestedKind)) {
      respondFederalFailure(req, res, 'ERR_FEDERAL_KIND_DISABLED')
      return
    }
    effectiveKind = requestedKind
  } else {
    effectiveKind = resolveEffectiveKind(policy)
    if (!effectiveKind) {
      // 管理 PUT 保证至少保 1；运行时兜底 400（kinds 全关）
      respondFederalFailure(req, res, 'ERR_FEDERAL_ALL_DISABLED')
      return
    }
  }

  try {
    if (effectiveKind === 'slider') {
      const strength = await getSliderStrengthSafe()
      const { id, image } = await federalCaptchaService.issueSlider(strength)
      res.json({
        captchaId: id,
        kind: 'slider',
        image,
        strength,
        expiresInSec: FEDERAL_EXPIRES_SEC,
      })
      return
    }
    if (effectiveKind === 'geometry') {
      const strength = await getSliderStrengthSafe()
      const result = await federalCaptchaService.issueGeometry({
        geometryLevel: policy.geometryLevel,
        strength,
        timeoutSec: policy.timeoutSec,
        strictTimeoutSec: policy.strictTimeoutSec,
        testFixed,
      })
      res.json({
        captchaId: result.id,
        kind: 'geometry',
        puzzleType: 'rotation',
        puzzle: { perm: result.perm, targetHour: result.targetHour },
        geometryLevel: result.geometryLevel,
        strength: result.strength,
        expiresInSec: FEDERAL_EXPIRES_SEC,
      })
      return
    }
    // pow
    const result = await federalCaptchaService.issuePow({
      powBits: policy.powBits,
      testFixed,
    })
    res.json({
      captchaId: result.id,
      kind: 'pow',
      challenge: result.challengeHex,
      bits: result.bits,
      expiresInSec: FEDERAL_EXPIRES_SEC,
      expiresAt: result.expiresAt.toISOString(),
    })
  } catch (error) {
    console.error('[FederalCaptcha] Issue failed, fallback slider-low:', error)
    await fallbackSliderLow(
      res,
      effectiveKind ?? 'unknown',
      error instanceof Error ? error.message : String(error),
    )
  }
}

export const verifyFederalCaptcha = async (req: Request, res: Response): Promise<void> => {
  if (hasFederalTestResetHeader(req) && process.env.NODE_ENV !== 'test') {
    res.status(404).json({ success: false, error: 'ERR_NOT_FOUND' })
    return
  }
  if (hasFederalTestResetHeader(req) && process.env.NODE_ENV === 'test') {
    // verify 附带清桶：先清（隔离用），再继续校验（调用方不应在需验的 verify 上附带此头，否则行被清致 400）
    try {
      await resetFederalIssueForTest(getClientIp(req))
    } catch {
      // ignore
    }
  }

  const body = (req.body ?? {}) as Record<string, unknown>
  const captchaId = body.captchaId
  const kind = body.kind
  if (typeof captchaId !== 'string' || captchaId.length === 0 || !isFederalKindValue(kind)) {
    respondFederalFailure(req, res, 'ERR_INVALID_FEDERAL_VERIFY_REQUEST')
    return
  }

  // 联邦总开关关闭时 verify 全回落语义：已颁发联邦题按快照照常校验（防切档 farming）；
  // 此处不直接回落 slider-low（verify 无签发，回落无意义），仍按 kind 判别校验。
  try {
    if (kind === 'geometry') {
      // 兼容两种载荷：{microSlot, behaviorSamples} 平铺，或 {solution:{microSlot, behaviorSamples}}
      const solution = body.solution as Record<string, unknown> | undefined
      const microSlot =
        body.microSlot !== undefined ? body.microSlot : (solution?.microSlot ?? solution?.angleDeg)
      const behaviorSamples =
        body.behaviorSamples !== undefined
          ? body.behaviorSamples
          : (solution?.behaviorSamples ?? solution?.dragPath)
      // 旧 angleDeg 载荷（冻结契约 v1.0.0 rotation）已作废：演示批准增量改小时钟微槽，angle 直接 400
      if (
        typeof (solution as Record<string, unknown> | undefined)?.angleDeg === 'number' &&
        microSlot === undefined
      ) {
        respondFederalFailure(req, res, 'ERR_DEPRECATED_GEOMETRY_PAYLOAD')
        return
      }
      const { strength } = await federalCaptchaService.verifyGeometry(
        captchaId,
        microSlot,
        behaviorSamples,
      )
      void strength
      res.json({ success: true, captchaId, kind })
      return
    }
    if (kind === 'pow') {
      const nonce = body.nonce
      await federalCaptchaService.verifyPow(captchaId, nonce)
      res.json({ success: true, captchaId, kind })
      return
    }
    // slider 联邦态：复用 drag 载荷（dragPath/totalDragTime/finalPosition，兼容 t/time）
    const dragPath = body.dragPath
    const totalDragTime = body.totalDragTime
    const finalPosition = body.finalPosition
    if (
      !Array.isArray(dragPath) ||
      typeof totalDragTime !== 'number' ||
      typeof finalPosition !== 'number'
    ) {
      respondFederalFailure(req, res, 'ERR_INVALID_SLIDER_PAYLOAD')
      return
    }
    const formatted = (dragPath as unknown[]).map((p: unknown) => {
      const rec = (p ?? {}) as Record<string, unknown>
      return { x: rec.x, y: rec.y, t: (rec.t ?? rec.time) as number }
    })
    // 联邦 slider 走独立消费（与旧 unlock 同语义，kind 一致性由 service 保证）
    await authApplicationService.verifyAndConsumeForUnlock(
      captchaId,
      formatted as { x: number; y: number; t: number }[],
      totalDragTime,
      finalPosition,
    )
    res.json({ success: true, captchaId, kind })
  } catch (error: unknown) {
    const internal = error instanceof Error ? error.message : String(error)
    // 统一对外码（篡改/错位姿/二次/并发落败/过期/不存在/kind 不一致全同一码，日志记真因）
    console.warn('[FederalCaptcha] Verify failed', {
      internalErrorCode: internal.startsWith('ERR_') ? internal : 'ERR_FEDERAL_VERIFY_FAILED',
      captchaId,
      kind,
    })
    res.status(400).json({ success: false, error: FEDERAL_FAILURE })
  }
}

export { normalizeStrength }

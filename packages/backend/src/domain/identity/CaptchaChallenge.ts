export type CaptchaStrength = 'low' | 'normal' | 'strict'

export interface CaptchaStrengthParams {
  tolerance: number
  minPoints: number
  minTimeMs: number
  maxTimeMs: number
}

export type FederalChallengeKind = 'slider' | 'geometry' | 'pow'

export interface CaptchaChallengeProps {
  id: string
  targetPosition: number
  verified: boolean
  expiresAt: Date
  strength?: CaptchaStrength
  challengeKind?: FederalChallengeKind
  challengeData?: Record<string, unknown> | null
  attempts?: number
}

export interface DragNode {
  x: number
  y: number
  t: number
}

/**
 * Callers: [PrismaCaptchaChallengeRepository, AuthApplicationService]
 * Callees: []
 * Description: Represents a CaptchaChallenge Aggregate Root. Encapsulates bot-detection heuristics and single-use invariant checks.
 * Keywords: captcha, challenge, aggregate, root, domain, entity, security, slider
 */
/**
 * B1 冻结强度三档（API-SPEC v1.0.2 x-strength-levels-frozen + PRD §6）：
 * - low（默认最宽松）：±20 / ≥8点 / 150–15000ms / 仅拒绝完全直线+完全匀速（放宽：varY===0 && varSpeedX===0）
 * - normal（现行）：±15 / ≥10点 / 200–10000ms / varY===0 && varSpeedX<0.01 拒绝
 * - strict（最严）：±8 / ≥15点 / 400–8000ms / Y方差与X速度方差双阈值严判（冻结：varY<5.0 || varSpeedX<0.1 拒绝）
 *   + 目标位置随机范围扩大（冻结：60–260；low/normal 为 80–240）
 */
export const CAPTCHA_STRENGTH_PARAMS: Record<CaptchaStrength, CaptchaStrengthParams> = {
  low: { tolerance: 20, minPoints: 8, minTimeMs: 150, maxTimeMs: 15000 },
  normal: { tolerance: 15, minPoints: 10, minTimeMs: 200, maxTimeMs: 10000 },
  strict: { tolerance: 8, minPoints: 15, minTimeMs: 400, maxTimeMs: 8000 },
}

/** strict 双阈值冻结值（实现时冻结，QA AC-4 容差边界不受影响） */
export const STRICT_VARIANCE_THRESHOLDS = {
  varY: 5.0,
  varSpeedX: 0.1,
} as const

/** strict 目标位置随机范围（冻结）；low/normal 为 80–240 */
export const CAPTCHA_TARGET_RANGE: Record<CaptchaStrength, { min: number; max: number }> = {
  low: { min: 80, max: 240 },
  normal: { min: 80, max: 240 },
  strict: { min: 60, max: 260 },
}

export function normalizeCaptchaStrength(value: unknown): CaptchaStrength {
  if (value === 'low' || value === 'normal' || value === 'strict') return value
  return 'normal'
}

export class CaptchaChallenge {
  private props: CaptchaChallengeProps

  /**
   * Callers: [CaptchaChallenge.create, PrismaCaptchaChallengeRepository.toDomain]
   * Callees: []
   * Description: Private constructor enforcing initialization through static factory methods to guarantee invariant constraints.
   * Keywords: constructor, captcha, challenge, entity, instantiation
   */
  private constructor(props: CaptchaChallengeProps) {
    this.props = { ...props }
  }

  /**
   * Callers: [PrismaCaptchaChallengeRepository, AuthApplicationService]
   * Callees: [CaptchaChallenge.constructor]
   * Description: Static factory method creating a new CaptchaChallenge entity after validating the target position and expiration time.
   * Keywords: create, factory, captcha, challenge, domain, instantiation
   */
  public static create(props: CaptchaChallengeProps): CaptchaChallenge {
    if (props.targetPosition < 0) {
      throw new Error('ERR_INVALID_TARGET_POSITION')
    }
    if (props.expiresAt <= new Date()) {
      throw new Error('ERR_CAPTCHA_ALREADY_EXPIRED')
    }
    return new CaptchaChallenge({
      strength: 'normal',
      challengeKind: 'slider',
      challengeData: null,
      attempts: 0,
      ...props,
    })
  }

  public static reconstitute(props: CaptchaChallengeProps): CaptchaChallenge {
    if (props.targetPosition < 0) {
      throw new Error('ERR_INVALID_TARGET_POSITION')
    }
    return new CaptchaChallenge({
      strength: 'normal',
      challengeKind: 'slider',
      challengeData: null,
      attempts: 0,
      ...props,
    })
  }

  // --- Accessors ---

  public get id(): string {
    return this.props.id
  }
  public get targetPosition(): number {
    return this.props.targetPosition
  }
  public get verified(): boolean {
    return this.props.verified
  }
  public get expiresAt(): Date {
    return this.props.expiresAt
  }
  public get strength(): CaptchaStrength {
    return this.props.strength ?? 'normal'
  }
  public get challengeKind(): FederalChallengeKind {
    const k = this.props.challengeKind
    if (k === 'geometry' || k === 'pow' || k === 'slider') return k
    return 'slider'
  }
  public get challengeData(): Record<string, unknown> | null {
    const d = this.props.challengeData
    if (d === undefined) return null
    return d
  }
  public get attempts(): number {
    const a = this.props.attempts
    return typeof a === 'number' && Number.isInteger(a) && a >= 0 ? a : 0
  }

  public incrementAttempts(): void {
    const next = this.attempts + 1
    this.props = { ...this.props, attempts: next }
  }

  // --- Domain Behaviors ---

  /**
   * Callers: [AuthApplicationService.verifyCaptcha]
   * Callees: []
   * Description: Evaluates a user's drag trajectory to verify human interaction. Encapsulates variance and speed calculations to detect linear or robotic movements.
   * Keywords: verify, trajectory, captcha, challenge, heuristic, bot, detection
   */
  public verifyTrajectory(
    dragPath: DragNode[],
    totalDragTime: number,
    finalPosition: number,
    strengthOverride?: CaptchaStrength,
  ): void {
    const strength: CaptchaStrength = strengthOverride ?? this.strength
    const params = CAPTCHA_STRENGTH_PARAMS[strength]
    if (this.props.expiresAt < new Date()) {
      throw new Error('ERR_CAPTCHA_EXPIRED')
    }
    if (this.props.verified) {
      throw new Error('ERR_CAPTCHA_ALREADY_VERIFIED')
    }

    if (
      !dragPath ||
      dragPath.length < params.minPoints ||
      totalDragTime < params.minTimeMs ||
      totalDragTime > params.maxTimeMs
    ) {
      throw new Error('ERR_AUTOMATION_DETECTED_INVALID_PATH')
    }

    // Heuristics: calculate variance of Y and speed of X
    let sumY = 0
    let sumSpeedX = 0
    const speedsX: number[] = []

    for (let i = 1; i < dragPath.length; i++) {
      const prev = dragPath[i - 1]
      const curr = dragPath[i]
      if (!prev || !curr) continue

      sumY += curr.y

      const dt = curr.t - prev.t
      if (dt > 0) {
        const speed = (curr.x - prev.x) / dt
        speedsX.push(speed)
        sumSpeedX += speed
      }
    }

    if (speedsX.length === 0) {
      throw new Error('ERR_AUTOMATION_DETECTED_INVALID_PATH')
    }

    const avgY = sumY / (dragPath.length - 1)
    const avgSpeedX = sumSpeedX / speedsX.length

    let varY = 0
    let varSpeedX = 0

    for (let i = 1; i < dragPath.length; i++) {
      const p = dragPath[i]
      if (p) {
        varY += Math.pow(p.y - avgY, 2)
      }
    }
    for (const speed of speedsX) {
      varSpeedX += Math.pow(speed - avgSpeedX, 2)
    }

    varY /= dragPath.length - 1
    varSpeedX /= speedsX.length

    // B1 三档方差判定（冻结）：
    // - low：仅拒绝完全直线+完全匀速（放宽：varSpeedX===0）
    // - normal：现行 varY===0 && varSpeedX<0.01
    // - strict：双阈值严判 varY<5.0 || varSpeedX<0.1
    if (strength === 'low') {
      if (varY === 0 && varSpeedX === 0) {
        throw new Error('ERR_AUTOMATION_DETECTED_LINEAR_TRAJECTORY')
      }
    } else if (strength === 'strict') {
      if (
        varY < STRICT_VARIANCE_THRESHOLDS.varY ||
        varSpeedX < STRICT_VARIANCE_THRESHOLDS.varSpeedX
      ) {
        throw new Error('ERR_AUTOMATION_DETECTED_LINEAR_TRAJECTORY')
      }
    } else {
      // If completely straight line (varY === 0) and perfectly constant speed, it's a bot
      if (varY === 0 && varSpeedX < 0.01) {
        throw new Error('ERR_AUTOMATION_DETECTED_LINEAR_TRAJECTORY')
      }
    }

    // Validate final position
    if (Math.abs(finalPosition - this.props.targetPosition) > params.tolerance) {
      throw new Error('ERR_INVALID_POSITION')
    }

    this.props.verified = true
  }

  /**
   * B2 解锁兑换专用验证：不依赖外部 /verify 标记（verified 无论 true/false 均重新按快照校验轨迹），
   * 校验通过后不置 verified（调用方直接删除行实现原子消费）。
   * Callers: [AuthApplicationService.verifyAndConsumeForUnlock]
   */
  public verifyTrajectoryForUnlock(
    dragPath: DragNode[],
    totalDragTime: number,
    finalPosition: number,
  ): void {
    const strength = this.strength
    const params = CAPTCHA_STRENGTH_PARAMS[strength]
    if (this.props.expiresAt < new Date()) {
      throw new Error('ERR_CAPTCHA_EXPIRED')
    }

    if (
      !dragPath ||
      dragPath.length < params.minPoints ||
      totalDragTime < params.minTimeMs ||
      totalDragTime > params.maxTimeMs
    ) {
      throw new Error('ERR_AUTOMATION_DETECTED_INVALID_PATH')
    }

    let sumY = 0
    let sumSpeedX = 0
    const speedsX: number[] = []

    for (let i = 1; i < dragPath.length; i++) {
      const prev = dragPath[i - 1]
      const curr = dragPath[i]
      if (!prev || !curr) continue

      sumY += curr.y

      const dt = curr.t - prev.t
      if (dt > 0) {
        const speed = (curr.x - prev.x) / dt
        speedsX.push(speed)
        sumSpeedX += speed
      }
    }

    if (speedsX.length === 0) {
      throw new Error('ERR_AUTOMATION_DETECTED_INVALID_PATH')
    }

    const avgY = sumY / (dragPath.length - 1)
    const avgSpeedX = sumSpeedX / speedsX.length

    let varY = 0
    let varSpeedX = 0

    for (let i = 1; i < dragPath.length; i++) {
      const p = dragPath[i]
      if (p) {
        varY += Math.pow(p.y - avgY, 2)
      }
    }
    for (const speed of speedsX) {
      varSpeedX += Math.pow(speed - avgSpeedX, 2)
    }

    varY /= dragPath.length - 1
    varSpeedX /= speedsX.length

    if (strength === 'low') {
      if (varY === 0 && varSpeedX === 0) {
        throw new Error('ERR_AUTOMATION_DETECTED_LINEAR_TRAJECTORY')
      }
    } else if (strength === 'strict') {
      if (
        varY < STRICT_VARIANCE_THRESHOLDS.varY ||
        varSpeedX < STRICT_VARIANCE_THRESHOLDS.varSpeedX
      ) {
        throw new Error('ERR_AUTOMATION_DETECTED_LINEAR_TRAJECTORY')
      }
    } else {
      if (varY === 0 && varSpeedX < 0.01) {
        throw new Error('ERR_AUTOMATION_DETECTED_LINEAR_TRAJECTORY')
      }
    }

    if (Math.abs(finalPosition - this.props.targetPosition) > params.tolerance) {
      throw new Error('ERR_INVALID_POSITION')
    }
  }

  /**
   * Callers: [AuthApplicationService.registerUser]
   * Callees: []
   * Description: Validates that the captcha has been verified and is not expired before consumption during registration.
   * Keywords: consume, validate, check, captcha, register
   */
  public validateForConsumption(): void {
    if (!this.props.verified) {
      throw new Error('ERR_CAPTCHA_NOT_VERIFIED')
    }
    if (this.props.expiresAt < new Date()) {
      throw new Error('ERR_CAPTCHA_EXPIRED')
    }
  }
}

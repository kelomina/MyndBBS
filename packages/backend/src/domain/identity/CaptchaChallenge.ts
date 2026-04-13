export interface CaptchaChallengeProps {
  id: string;
  targetPosition: number;
  verified: boolean;
  expiresAt: Date;
}

export interface DragNode {
  x: number;
  y: number;
  t: number;
}

/**
 * Callers: [PrismaCaptchaChallengeRepository, AuthApplicationService]
 * Callees: []
 * Description: Represents a CaptchaChallenge Aggregate Root. Encapsulates bot-detection heuristics and single-use invariant checks.
 * Keywords: captcha, challenge, aggregate, root, domain, entity, security, slider
 */
export class CaptchaChallenge {
  private props: CaptchaChallengeProps;

  /**
   * Callers: [CaptchaChallenge.create, PrismaCaptchaChallengeRepository.toDomain]
   * Callees: []
   * Description: Private constructor enforcing initialization through static factory methods to guarantee invariant constraints.
   * Keywords: constructor, captcha, challenge, entity, instantiation
   */
  private constructor(props: CaptchaChallengeProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [PrismaCaptchaChallengeRepository, AuthApplicationService]
   * Callees: [CaptchaChallenge.constructor]
   * Description: Static factory method creating a new CaptchaChallenge entity after validating the target position and expiration time.
   * Keywords: create, factory, captcha, challenge, domain, instantiation
   */
  public static create(props: CaptchaChallengeProps): CaptchaChallenge {
    if (props.targetPosition < 0) {
      throw new Error('ERR_INVALID_TARGET_POSITION');
    }
    if (props.expiresAt <= new Date()) {
      throw new Error('ERR_CAPTCHA_ALREADY_EXPIRED');
    }
    return new CaptchaChallenge(props);
  }

  // --- Accessors ---

  public get id(): string { return this.props.id; }
  public get targetPosition(): number { return this.props.targetPosition; }
  public get verified(): boolean { return this.props.verified; }
  public get expiresAt(): Date { return this.props.expiresAt; }

  // --- Domain Behaviors ---

  /**
   * Callers: [AuthApplicationService.verifyCaptcha]
   * Callees: []
   * Description: Evaluates a user's drag trajectory to verify human interaction. Encapsulates variance and speed calculations to detect linear or robotic movements.
   * Keywords: verify, trajectory, captcha, challenge, heuristic, bot, detection
   */
  public verifyTrajectory(dragPath: DragNode[], totalDragTime: number, finalPosition: number): void {
    if (this.props.expiresAt < new Date()) {
      throw new Error('ERR_CAPTCHA_EXPIRED');
    }
    if (this.props.verified) {
      throw new Error('ERR_CAPTCHA_ALREADY_VERIFIED');
    }

    if (!dragPath || dragPath.length < 10 || totalDragTime < 200 || totalDragTime > 10000) {
      throw new Error('ERR_AUTOMATION_DETECTED_INVALID_PATH');
    }

    // Heuristics: calculate variance of Y and speed of X
    let sumY = 0;
    let sumSpeedX = 0;
    const speedsX: number[] = [];

    for (let i = 1; i < dragPath.length; i++) {
      const prev = dragPath[i - 1];
      const curr = dragPath[i];
      sumY += curr.y;
      
      const dt = curr.t - prev.t;
      if (dt > 0) {
        const speed = (curr.x - prev.x) / dt;
        speedsX.push(speed);
        sumSpeedX += speed;
      }
    }

    const avgY = sumY / (dragPath.length - 1);
    const avgSpeedX = sumSpeedX / speedsX.length;

    let varY = 0;
    let varSpeedX = 0;

    for (let i = 1; i < dragPath.length; i++) {
      varY += Math.pow(dragPath[i].y - avgY, 2);
    }
    for (const speed of speedsX) {
      varSpeedX += Math.pow(speed - avgSpeedX, 2);
    }

    varY /= (dragPath.length - 1);
    varSpeedX /= speedsX.length;

    // If completely straight line (varY === 0) and perfectly constant speed, it's a bot
    if (varY === 0 && varSpeedX < 0.01) {
      throw new Error('ERR_AUTOMATION_DETECTED_LINEAR_TRAJECTORY');
    }

    // Validate final position
    const VALIDATION_TOLERANCE = 15;
    if (Math.abs(finalPosition - this.props.targetPosition) > VALIDATION_TOLERANCE) {
      throw new Error('ERR_INVALID_POSITION');
    }

    this.props.verified = true;
  }

  /**
   * Callers: [AuthApplicationService.registerUser]
   * Callees: []
   * Description: Validates that the captcha has been verified and is not expired before consumption during registration.
   * Keywords: consume, validate, check, captcha, register
   */
  public validateForConsumption(): void {
    if (!this.props.verified) {
      throw new Error('ERR_CAPTCHA_NOT_VERIFIED');
    }
    if (this.props.expiresAt < new Date()) {
      throw new Error('ERR_CAPTCHA_EXPIRED');
    }
  }
}
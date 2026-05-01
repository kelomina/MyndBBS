export interface AuthChallengeProps {
  id: string;
  challenge: string;
  expiresAt: Date;
}

/**
 * 类名称：AuthChallenge
 *
 * 函数作用：
 *   身份域中的认证挑战聚合根。管理 WebAuthn、Sudo 等场景的短期挑战。
 * Purpose:
 *   AuthChallenge Aggregate Root in the Identity domain. Manages short-lived challenges for WebAuthn, sudo, etc.
 *
 * 中文关键词：
 *   认证挑战，聚合根，WebAuthn，Sudo
 * English keywords:
 *   auth challenge, aggregate root, WebAuthn, sudo
 */
export class AuthChallenge {
  private props: AuthChallengeProps;

  /**
   * 函数名称：constructor（私有）
   *
   * 函数作用：
   *   私有构造函数，强制通过静态工厂方法实例化。
   * Purpose:
   *   Private constructor to enforce instantiation via static factory methods.
   */
  private constructor(props: AuthChallengeProps) {
    this.props = { ...props };
  }

  /**
   * 函数名称：create
   *
   * 函数作用：
   *   静态工厂方法——创建新的认证挑战。
   * Purpose:
   *   Static factory method — creates a new auth challenge.
   *
   * 参数说明 / Parameters:
   *   - props: AuthChallengeProps（challenge 必填，expiresAt 不能在过去）
   *
   * 错误处理 / Error handling:
   *   - ERR_AUTH_CHALLENGE_MISSING_DATA
   *   - ERR_AUTH_CHALLENGE_ALREADY_EXPIRED
   *
   * 中文关键词：
   创建认证挑战
   * English keywords:
   *   create auth challenge
   */
  public static create(props: AuthChallengeProps): AuthChallenge {
    if (!props.challenge) {
      throw new Error('ERR_AUTH_CHALLENGE_MISSING_DATA');
    }
    if (props.expiresAt < new Date()) {
      throw new Error('ERR_AUTH_CHALLENGE_ALREADY_EXPIRED');
    }
    return new AuthChallenge(props);
  }

  /**
   * Callers: [PrismaAuthChallengeRepository]
   * Callees: [AuthChallenge.constructor]
   * Description: Static factory method reconstituting an AuthChallenge entity from database state.
   * Keywords: load, factory, authchallenge, domain, reconstitute
   */
  public static load(props: AuthChallengeProps): AuthChallenge {
    return new AuthChallenge(props);
  }

  // --- Accessors ---

  public get id(): string { return this.props.id; }
  public get challenge(): string { return this.props.challenge; }
  public get expiresAt(): Date { return this.props.expiresAt; }

  // --- Domain Behaviors ---

  /**
   * 函数名称：validateForConsumption
   *
   * 函数作用：
   *   验证挑战是否仍可消费（未过期）。
   * Purpose:
   *   Validates the challenge can still be consumed (not expired).
   *
   * 错误处理 / Error handling:
   *   - ERR_AUTH_CHALLENGE_EXPIRED（挑战已过期）
   *
   * 中文关键词：
   验证挑战，消费
   * English keywords:
   *   validate challenge, consume
   */
  public validateForConsumption(): void {
    if (new Date() > this.props.expiresAt) {
      throw new Error('ERR_AUTH_CHALLENGE_EXPIRED');
    }
  }
}
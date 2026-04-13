export interface AuthChallengeProps {
  id: string;
  challenge: string;
  expiresAt: Date;
}

/**
 * Callers: [PrismaAuthChallengeRepository, AuthApplicationService]
 * Callees: []
 * Description: Represents the AuthChallenge Aggregate Root within the Identity domain. Manages short-lived authentication challenges.
 * Keywords: authchallenge, aggregate, root, domain, entity, identity, webauthn, sudo, challenge
 */
export class AuthChallenge {
  private props: AuthChallengeProps;

  /**
   * Callers: [AuthChallenge.create, PrismaAuthChallengeRepository.toDomain]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, authchallenge, entity, instantiation
   */
  private constructor(props: AuthChallengeProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [PrismaAuthChallengeRepository, AuthApplicationService]
   * Callees: [AuthChallenge.constructor]
   * Description: Static factory method creating a new AuthChallenge entity.
   * Keywords: create, factory, authchallenge, domain, instantiation
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
   * Callers: [AuthApplicationService.consumeAuthChallenge]
   * Callees: []
   * Description: Validates whether the challenge can still be consumed.
   * Keywords: validate, consume, authchallenge, expired, identity
   */
  public validateForConsumption(): void {
    if (new Date() > this.props.expiresAt) {
      throw new Error('ERR_AUTH_CHALLENGE_EXPIRED');
    }
  }
}
export interface SessionProps {
  id: string;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Callers: [PrismaSessionRepository, AuthApplicationService]
 * Callees: []
 * Description: Represents the Session Aggregate Root within the Identity domain. Manages user login session lifecycles.
 * Keywords: session, aggregate, root, domain, entity, identity, login, token
 */
export class Session {
  private props: SessionProps;

  /**
   * Callers: [Session.create, PrismaSessionRepository.toDomain]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, session, entity, instantiation
   */
  private constructor(props: SessionProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [PrismaSessionRepository, AuthApplicationService]
   * Callees: [Session.constructor]
   * Description: Static factory method creating a new Session entity.
   * Keywords: create, factory, session, domain, instantiation
   */
  public static create(props: SessionProps): Session {
    if (!props.userId) {
      throw new Error('ERR_SESSION_MISSING_USER_ID');
    }
    if (props.expiresAt < new Date()) {
      throw new Error('ERR_SESSION_ALREADY_EXPIRED');
    }
    return new Session(props);
  }

  /**
   * Callers: [PrismaSessionRepository]
   * Callees: [Session.constructor]
   * Description: Static factory method reconstituting a Session entity from database state, bypassing creation constraints.
   * Keywords: load, factory, session, domain, reconstitute
   */
  public static load(props: SessionProps): Session {
    return new Session(props);
  }

  // --- Accessors ---

  public get id(): string { return this.props.id; }
  public get userId(): string { return this.props.userId; }
  public get ipAddress(): string | null { return this.props.ipAddress; }
  public get userAgent(): string | null { return this.props.userAgent; }
  public get expiresAt(): Date { return this.props.expiresAt; }
  public get createdAt(): Date { return this.props.createdAt; }

  // --- Domain Behaviors ---

  /**
   * Callers: [AuthApplicationService.validateSession]
   * Callees: []
   * Description: Checks whether the session has expired based on its expiration date.
   * Keywords: check, expired, session, identity
   */
  public isExpired(): boolean {
    return new Date() > this.props.expiresAt;
  }
}
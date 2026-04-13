export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BANNED = 'BANNED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION'
}

export interface UserProps {
  id: string;
  email: string;
  username: string;
  password: string | null;
  roleId: string | null;
  status: UserStatus;
  level: number;
  isPasskeyMandatory: boolean;
  totpSecret: string | null;
  isTotpEnabled: boolean;
  createdAt: Date;
}

/**
 * Callers: [PrismaUserRepository, UserApplicationService]
 * Callees: []
 * Description: Represents the User Aggregate Root within the Identity domain. Manages profile details, roles, levels, and two-factor authentication states.
 * Keywords: user, aggregate, root, domain, entity, identity, totp, role, level
 */
export class User {
  private props: UserProps;

  /**
   * Callers: [User.create, PrismaUserRepository.toDomain]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, user, entity, instantiation
   */
  private constructor(props: UserProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [PrismaUserRepository, UserApplicationService]
   * Callees: [User.constructor]
   * Description: Static factory method creating a new User entity.
   * Keywords: create, factory, user, domain, instantiation
   */
  public static create(props: UserProps): User {
    return new User(props);
  }

  // --- Accessors ---

  public get id(): string { return this.props.id; }
  public get email(): string { return this.props.email; }
  public get username(): string { return this.props.username; }
  public get password(): string | null { return this.props.password; }
  public get roleId(): string | null { return this.props.roleId; }
  public get status(): UserStatus { return this.props.status; }
  public get level(): number { return this.props.level; }
  public get isPasskeyMandatory(): boolean { return this.props.isPasskeyMandatory; }
  public get totpSecret(): string | null { return this.props.totpSecret; }
  public get isTotpEnabled(): boolean { return this.props.isTotpEnabled; }
  public get createdAt(): Date { return this.props.createdAt; }

  // --- Domain Behaviors ---

  /**
   * Callers: [UserApplicationService.updateProfile]
   * Callees: []
   * Description: Updates the user's basic profile information.
   * Keywords: update, profile, user, identity, email, username
   */
  public updateProfile(email?: string, username?: string, hashedPassword?: string): void {
    if (email) this.props.email = email;
    if (username) this.props.username = username;
    if (hashedPassword) this.props.password = hashedPassword;
  }

  /**
   * Callers: [UserApplicationService.enableTotp]
   * Callees: []
   * Description: Enables TOTP 2FA and securely sets the secret.
   * Keywords: enable, totp, secret, user, identity
   */
  public enableTotp(secret: string): void {
    if (!secret) throw new Error('ERR_TOTP_SECRET_REQUIRED');
    this.props.totpSecret = secret;
    this.props.isTotpEnabled = true;
  }

  /**
   * Callers: [UserApplicationService.disableTotp]
   * Callees: []
   * Description: Disables TOTP 2FA and removes the secret.
   * Keywords: disable, totp, secret, user, identity
   */
  public disableTotp(): void {
    this.props.totpSecret = null;
    this.props.isTotpEnabled = false;
  }

  /**
   * Callers: [UserApplicationService.changeRole]
   * Callees: []
   * Description: Updates the user's role.
   * Keywords: change, role, user, identity
   */
  public changeRole(roleId: string | null): void {
    this.props.roleId = roleId;
  }

  /**
   * Callers: [UserApplicationService.changeLevel, UserApplicationService.syncLevelForPasskey]
   * Callees: []
   * Description: Updates the user's security level.
   * Keywords: change, level, user, identity
   */
  public changeLevel(level: number): void {
    if (level < 1 || level > 6) {
      throw new Error('ERR_LEVEL_OUT_OF_BOUNDS');
    }
    this.props.level = level;
  }

  /**
   * Callers: [UserApplicationService.changeStatus]
   * Callees: []
   * Description: Updates the user's status (e.g., ACTIVE, BANNED).
   * Keywords: change, status, user, identity
   */
  public changeStatus(status: UserStatus): void {
    this.props.status = status;
  }
}
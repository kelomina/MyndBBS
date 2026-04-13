export interface UserKeyProps {
  userId: string;
  scheme: string;
  publicKey: string;
  encryptedPrivateKey: string;
  mlKemPublicKey: string | null;
  encryptedMlKemPrivateKey: string | null;
}

/**
 * Callers: [PrismaUserKeyRepository, MessagingApplicationService]
 * Callees: []
 * Description: Represents the UserKey Aggregate Root within the Messaging domain. Manages cryptographic keys for end-to-end encryption.
 * Keywords: userkey, aggregate, root, domain, entity, messaging, crypto, keys, e2ee
 */
export class UserKey {
  private props: UserKeyProps;

  /**
   * Callers: [UserKey.create, PrismaUserKeyRepository.toDomain]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, userkey, entity, instantiation
   */
  private constructor(props: UserKeyProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [PrismaUserKeyRepository, MessagingApplicationService.uploadKeys]
   * Callees: [UserKey.constructor]
   * Description: Static factory method creating a new UserKey entity. Validates essential key components.
   * Keywords: create, factory, userkey, domain, instantiation
   */
  public static create(props: UserKeyProps): UserKey {
    if (!props.userId || !props.scheme || !props.publicKey || !props.encryptedPrivateKey) {
      throw new Error('ERR_USER_KEY_MISSING_REQUIRED_FIELDS');
    }
    return new UserKey(props);
  }

  /**
   * Callers: [PrismaUserKeyRepository]
   * Callees: [UserKey.constructor]
   * Description: Static factory method reconstituting a UserKey entity from database state.
   * Keywords: load, factory, userkey, domain, reconstitute
   */
  public static load(props: UserKeyProps): UserKey {
    return new UserKey(props);
  }

  // --- Accessors ---

  public get userId(): string { return this.props.userId; }
  public get scheme(): string { return this.props.scheme; }
  public get publicKey(): string { return this.props.publicKey; }
  public get encryptedPrivateKey(): string { return this.props.encryptedPrivateKey; }
  public get mlKemPublicKey(): string | null { return this.props.mlKemPublicKey; }
  public get encryptedMlKemPrivateKey(): string | null { return this.props.encryptedMlKemPrivateKey; }

  // --- Domain Behaviors ---

  /**
   * Callers: [MessagingApplicationService.uploadKeys]
   * Callees: []
   * Description: Updates the user's cryptographic keys and scheme.
   * Keywords: update, keys, userkey, crypto, scheme
   */
  public updateKeys(scheme: string, publicKey: string, encryptedPrivateKey: string, mlKemPublicKey: string | null, encryptedMlKemPrivateKey: string | null): void {
    if (!scheme || !publicKey || !encryptedPrivateKey) {
      throw new Error('ERR_USER_KEY_MISSING_REQUIRED_FIELDS');
    }
    this.props.scheme = scheme;
    this.props.publicKey = publicKey;
    this.props.encryptedPrivateKey = encryptedPrivateKey;
    this.props.mlKemPublicKey = mlKemPublicKey;
    this.props.encryptedMlKemPrivateKey = encryptedMlKemPrivateKey;
  }
}
export interface PasskeyProps {
  id: string; // credentialId
  publicKey: Buffer;
  userId: string;
  webAuthnUserID: string;
  counter: bigint;
  deviceType: string;
  backedUp: boolean;
  createdAt: Date;
}

/**
 * Callers: [PrismaPasskeyRepository, AuthApplicationService]
 * Callees: []
 * Description: Represents a WebAuthn Passkey associated with a User. Acts as a credential entity within the Identity domain.
 * Keywords: passkey, webauthn, credential, entity, identity, domain
 */
export class Passkey {
  private props: PasskeyProps;

  /**
   * Callers: [Passkey.create, PrismaPasskeyRepository.toDomain]
   * Callees: []
   * Description: Private constructor to enforce initialization via static factory methods.
   * Keywords: constructor, passkey, entity, instantiation
   */
  private constructor(props: PasskeyProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [PrismaPasskeyRepository, AuthApplicationService]
   * Callees: [Passkey.constructor]
   * Description: Static factory method creating a new Passkey entity after validating its core components.
   * Keywords: create, factory, passkey, domain, instantiation
   */
  public static create(props: PasskeyProps): Passkey {
    if (!props.userId || !props.id || !props.publicKey) {
      throw new Error('ERR_PASSKEY_MISSING_REQUIRED_FIELDS');
    }
    return new Passkey(props);
  }

  // --- Accessors ---

  public get id(): string { return this.props.id; }
  public get publicKey(): Buffer { return this.props.publicKey; }
  public get userId(): string { return this.props.userId; }
  public get webAuthnUserID(): string { return this.props.webAuthnUserID; }
  public get counter(): bigint { return this.props.counter; }
  public get deviceType(): string { return this.props.deviceType; }
  public get backedUp(): boolean { return this.props.backedUp; }
  public get createdAt(): Date { return this.props.createdAt; }

  // --- Domain Behaviors ---

  /**
   * Callers: [AuthApplicationService.verifyAuthentication]
   * Callees: []
   * Description: Updates the passkey counter to prevent replay attacks.
   * Keywords: update, counter, passkey, webauthn, replay, protection
   */
  public updateCounter(newCounter: bigint): void {
    if (newCounter < this.props.counter) {
      throw new Error('ERR_PASSKEY_COUNTER_MISMATCH_POSSIBLE_REPLAY');
    }
    this.props.counter = newCounter;
  }
}
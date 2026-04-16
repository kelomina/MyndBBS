export interface PrivateMessageProps {
  id: string;
  senderId: string;
  receiverId: string;
  ephemeralPublicKey: string;
  ephemeralMlKemCiphertext: string | null;
  encryptedContent: string;
  senderEncryptedContent: string | null;
  isRead: boolean;
  isSystem: boolean;
  expiresAt: Date | null;
  deletedBy: string[];
  createdAt: Date;
}

/**
 * Callers: [PrismaPrivateMessageRepository, MessagingApplicationService]
 * Callees: []
 * Description: Represents a PrivateMessage Aggregate Root. Handles encrypted message data and read status invariants.
 * Keywords: private, message, aggregate, root, domain, entity, messaging, encrypted
 */
export class PrivateMessage {
  private props: PrivateMessageProps;

  /**
   * Callers: [PrivateMessage.create, PrismaPrivateMessageRepository.toDomain]
   * Callees: []
   * Description: Private constructor enforcing initialization through static factory methods.
   * Keywords: constructor, message, entity, instantiation
   */
  private constructor(props: PrivateMessageProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [PrismaPrivateMessageRepository, MessagingApplicationService]
   * Callees: [PrivateMessage.constructor]
   * Description: Static factory method creating a new PrivateMessage entity.
   * Keywords: create, factory, message, domain, instantiation
   */
  public static create(
    props: PrivateMessageProps,
    senderLevel: number,
    isFriend: boolean,
    sentCountToNonFriend: number
  ): PrivateMessage {
    if (!props.senderId || !props.receiverId || !props.encryptedContent) {
      throw new Error('ERR_MESSAGE_MISSING_REQUIRED_FIELDS');
    }

    if (senderLevel < 2) {
      throw new Error('ERR_LEVEL_TOO_LOW');
    }

    if (!isFriend && sentCountToNonFriend >= 3) {
      throw new Error('ERR_FRIEND_REQUIRED_LIMIT_REACHED');
    }

    return new PrivateMessage(props);
  }

  /**
   * Callers: [PrismaPrivateMessageRepository]
   * Callees: [PrivateMessage.constructor]
   * Description: Static factory method for reconstituting an existing PrivateMessage entity from persistence.
   * Keywords: load, factory, message, domain, persistence, deserialize
   */
  public static load(props: PrivateMessageProps): PrivateMessage {
    return new PrivateMessage(props);
  }

  // --- Accessors ---

  public get id(): string { return this.props.id; }
  public get senderId(): string { return this.props.senderId; }
  public get receiverId(): string { return this.props.receiverId; }
  public get ephemeralPublicKey(): string { return this.props.ephemeralPublicKey; }
  public get ephemeralMlKemCiphertext(): string | null { return this.props.ephemeralMlKemCiphertext; }
  public get encryptedContent(): string { return this.props.encryptedContent; }
  public get senderEncryptedContent(): string | null { return this.props.senderEncryptedContent; }
  public get isRead(): boolean { return this.props.isRead; }
  public get isSystem(): boolean { return this.props.isSystem; }
  public get expiresAt(): Date | null { return this.props.expiresAt; }
  public get deletedBy(): string[] { return [...this.props.deletedBy]; }
  public get createdAt(): Date { return this.props.createdAt; }

  // --- Domain Behaviors ---

  /**
   * Callers: [MessagingApplicationService.markAsRead]
   * Callees: []
   * Description: Marks the message as read by the receiver.
   * Keywords: mark, read, message, state, transition
   */
  public markAsRead(userId: string): void {
    if (this.props.receiverId !== userId) {
      throw new Error('ERR_FORBIDDEN_NOT_RECEIVER');
    }
    if (this.props.isRead) {
      throw new Error('ERR_MESSAGE_ALREADY_READ');
    }
    this.props.isRead = true;
  }

  /**
   * Callers: [MessagingApplicationService.deleteForUser]
   * Callees: []
   * Description: Marks the message as deleted for a specific user (soft delete).
   * Keywords: delete, message, soft, user, messaging
   */
  public deleteForUser(userId: string, isHardDeleteAllowed: boolean = false): boolean {
    if (this.props.senderId !== userId && this.props.receiverId !== userId) {
      throw new Error('ERR_FORBIDDEN_NOT_PARTICIPANT');
    }
    if (isHardDeleteAllowed && this.props.senderId === userId) {
      return true; // Signal that it should be hard deleted
    }
    if (!this.props.deletedBy.includes(userId)) {
      this.props.deletedBy.push(userId);
    }
    if (this.props.deletedBy.includes(this.props.senderId) && this.props.deletedBy.includes(this.props.receiverId)) {
      return true; // Signal that both deleted it, so hard delete
    }
    return false; // Signal soft delete
  }
}
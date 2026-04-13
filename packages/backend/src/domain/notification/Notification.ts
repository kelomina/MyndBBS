export interface NotificationProps {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  relatedId: string | null;
  read: boolean;
  createdAt: Date;
}

/**
 * Callers: [PrismaNotificationRepository, NotificationApplicationService]
 * Callees: []
 * Description: Represents a Notification Aggregate Root. Encapsulates the state and invariants of a system notification for a specific user.
 * Keywords: notification, aggregate, root, domain, entity, message, user
 */
export class Notification {
  private props: NotificationProps;

  /**
   * Callers: [Notification.create, PrismaNotificationRepository.toDomain]
   * Callees: []
   * Description: Private constructor enforcing initialization through static factory methods to guarantee invariant constraints.
   * Keywords: constructor, notification, entity, instantiation
   */
  private constructor(props: NotificationProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [PrismaNotificationRepository, NotificationApplicationService]
   * Callees: [Notification.constructor]
   * Description: Static factory method creating a new Notification entity after validating the recipient and content.
   * Keywords: create, factory, notification, domain, instantiation
   */
  public static create(props: NotificationProps): Notification {
    if (!props.userId || !props.type || !props.title || !props.content) {
      throw new Error('ERR_NOTIFICATION_MISSING_REQUIRED_FIELDS');
    }
    return new Notification(props);
  }

  // --- Accessors ---

  public get id(): string { return this.props.id; }
  public get userId(): string { return this.props.userId; }
  public get type(): string { return this.props.type; }
  public get title(): string { return this.props.title; }
  public get content(): string { return this.props.content; }
  public get relatedId(): string | null { return this.props.relatedId; }
  public get read(): boolean { return this.props.read; }
  public get createdAt(): Date { return this.props.createdAt; }

  // --- Domain Behaviors ---

  /**
   * Callers: [NotificationApplicationService.markAsRead]
   * Callees: []
   * Description: Marks the notification as read. Validates that the state transitions correctly.
   * Keywords: mark, read, notification, state, transition
   */
  public markAsRead(): void {
    if (this.props.read) {
      throw new Error('ERR_NOTIFICATION_ALREADY_READ');
    }
    this.props.read = true;
  }
}
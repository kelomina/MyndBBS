import { IDomainEvent } from './IEventBus';

export class PostApprovedEvent implements IDomainEvent {
  public readonly eventName = 'PostApprovedEvent';
  public readonly occurredOn: Date;

  constructor(
    public readonly postId: string,
    public readonly authorId: string,
    public readonly postTitle: string
  ) {
    this.occurredOn = new Date();
  }
}

export class PostRejectedEvent implements IDomainEvent {
  public readonly eventName = 'PostRejectedEvent';
  public readonly occurredOn: Date;

  constructor(
    public readonly postId: string,
    public readonly authorId: string,
    public readonly postTitle: string,
    public readonly reason: string
  ) {
    this.occurredOn = new Date();
  }
}

export class PostRepliedEvent implements IDomainEvent {
  public readonly eventName = 'PostRepliedEvent';
  public readonly occurredOn: Date;

  constructor(
    public readonly postId: string,
    public readonly authorId: string,
    public readonly postTitle: string,
    public readonly replierId: string,
    public readonly commentId: string
  ) {
    this.occurredOn = new Date();
  }
}

export class CommentRepliedEvent implements IDomainEvent {
  public readonly eventName = 'CommentRepliedEvent';
  public readonly occurredOn: Date;

  constructor(
    public readonly parentCommentId: string,
    public readonly authorId: string,
    public readonly postId: string,
    public readonly replierId: string,
    public readonly childCommentId: string
  ) {
    this.occurredOn = new Date();
  }
}

export class ModeratedWordAddedEvent implements IDomainEvent {
  public readonly eventName = 'ModeratedWordAddedEvent';
  public readonly occurredOn: Date;

  constructor(
    public readonly id: string,
    public readonly word: string,
    public readonly categoryId: string | null
  ) {
    this.occurredOn = new Date();
  }
}

export class ModeratedWordDeletedEvent implements IDomainEvent {
  public readonly eventName = 'ModeratedWordDeletedEvent';
  public readonly occurredOn: Date;

  constructor(
    public readonly id: string,
    public readonly word: string,
    public readonly categoryId: string | null
  ) {
    this.occurredOn = new Date();
  }
}

export class CategoryModeratorAssignedEvent implements IDomainEvent {
  public readonly eventName = 'CategoryModeratorAssignedEvent';
  public readonly occurredOn: Date;

  /**
   * Callers: [CommunityApplicationService]
   * Callees: [AuditEventListener]
   * Description: Emitted when a moderator is assigned to a category.
   * Keywords: event, category, moderator, assigned
   */
  constructor(
    public readonly categoryId: string,
    public readonly userId: string,
    public readonly operatorId: string
  ) {
    this.occurredOn = new Date();
  }
}

export class CategoryModeratorRemovedEvent implements IDomainEvent {
  public readonly eventName = 'CategoryModeratorRemovedEvent';
  public readonly occurredOn: Date;

  /**
   * Callers: [CommunityApplicationService]
   * Callees: [AuditEventListener]
   * Description: Emitted when a category is created.
   * Keywords: event, category, created
   */
  constructor(
    public readonly categoryId: string,
    public readonly userId: string,
    public readonly operatorId: string
  ) {
    this.occurredOn = new Date();
  }
}

export class CategoryCreatedEvent implements IDomainEvent {
  public readonly eventName = 'CategoryCreatedEvent';
  public readonly occurredOn: Date;

  /**
   * Callers: [CommunityApplicationService]
   * Callees: [AuditEventListener]
   * Description: Emitted when a moderator is removed from a category.
   * Keywords: event, category, moderator, removed
   */
  constructor(
    public readonly categoryId: string,
    public readonly operatorId: string
  ) {
    this.occurredOn = new Date();
  }
}

export class CategoryUpdatedEvent implements IDomainEvent {
  public readonly eventName = 'CategoryUpdatedEvent';
  public readonly occurredOn: Date;

  /**
   * Callers: [CommunityApplicationService]
   * Callees: [AuditEventListener]
   * Description: Emitted when a category is updated.
   * Keywords: event, category, updated
   */
  constructor(
    public readonly categoryId: string,
    public readonly operatorId: string
  ) {
    this.occurredOn = new Date();
  }
}

export class CategoryDeletedEvent implements IDomainEvent {
  public readonly eventName = 'CategoryDeletedEvent';
  public readonly occurredOn: Date;

  /**
   * Callers: [CommunityApplicationService]
   * Callees: [AuditEventListener]
   * Description: Emitted when a category is deleted.
   * Keywords: event, category, deleted
   */
  constructor(
    public readonly categoryId: string,
    public readonly operatorId: string
  ) {
    this.occurredOn = new Date();
  }
}

export class UserPromotedEvent implements IDomainEvent {
  public readonly eventName = 'UserPromotedEvent';
  public readonly occurredOn: Date;

  /**
   * Callers: [AdminUserManagementApplicationService]
   * Callees: [AuditEventListener]
   * Description: Emitted when a user's level is changed.
   * Keywords: event, user, level, promoted
   */
  constructor(
    public readonly targetUserId: string,
    public readonly newLevel: number,
    public readonly operatorId: string
  ) {
    this.occurredOn = new Date();
  }
}

export class UserStatusChangedEvent implements IDomainEvent {
  public readonly eventName = 'UserStatusChangedEvent';
  public readonly occurredOn: Date;

  /**
   * Callers: [AdminUserManagementApplicationService]
   * Callees: [AuditEventListener]
   * Description: Emitted when a user's status is changed.
   * Keywords: event, user, status, changed
   */
  constructor(
    public readonly targetUserId: string,
    public readonly newStatus: string,
    public readonly operatorId: string
  ) {
    this.occurredOn = new Date();
  }
}

export class UserRoleChangedEvent implements IDomainEvent {
  public readonly eventName = 'UserRoleChangedEvent';
  public readonly occurredOn: Date;

  /**
   * Callers: [AdminUserManagementApplicationService]
   * Callees: [AuditEventListener]
   * Description: Emitted when a user's role is changed.
   * Keywords: event, user, role, changed
   */
  constructor(
    public readonly targetUserId: string,
    public readonly newRole: string,
    public readonly operatorId: string
  ) {
    this.occurredOn = new Date();
  }
}

export class DbConfigUpdatedEvent implements IDomainEvent {
  public readonly eventName = 'DbConfigUpdatedEvent';
  public readonly occurredOn: Date;

  /**
   * Callers: [InstallationApplicationService]
   * Callees: [AuditEventListener]
   * Description: Emitted when the database configuration is updated.
   * Keywords: event, db, config, updated
   */
  constructor(
    public readonly operatorId: string
  ) {
    this.occurredOn = new Date();
  }
}
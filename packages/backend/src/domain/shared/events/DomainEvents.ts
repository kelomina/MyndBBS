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
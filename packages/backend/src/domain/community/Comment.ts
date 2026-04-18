import { AggregateRoot } from '../shared/AggregateRoot';

export interface CommentProps {
  id: string;
  content: string;
  postId: string;
  authorId: string;
  parentId: string | null;
  isPending: boolean;
  deletedAt: Date | null;
  createdAt: Date;
}

export type CreateCommentProps = Omit<CommentProps, 'isPending'>;

/**
 * Callers: [PrismaCommentRepository, CommunityApplicationService, ModerationApplicationService]
 * Callees: []
 * Description: Represents the Comment Aggregate Root within the Community domain. Manages forum reply states and transitions.
 * Keywords: comment, aggregate, root, domain, entity, forum, reply, community
 */
export class Comment extends AggregateRoot {
  private props: CommentProps;

  /**
   * Callers: [Comment.create, Comment.load, PrismaCommentRepository.toDomain]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, comment, entity, instantiation
   */
  private constructor(props: CommentProps) {
    super();
    this.props = { ...props };
  }

  /**
   * Callers: [CommunityApplicationService]
   * Callees: [Comment.constructor]
   * Description: Static factory method creating a new Comment entity. Validates basic content requirements and sets initial pending status.
   * Keywords: create, factory, comment, domain, instantiation
   */
  public static create(props: CreateCommentProps, isModerated: boolean): Comment {
    if (!props.content || props.content.trim().length === 0) {
      throw new Error('ERR_COMMENT_CONTENT_CANNOT_BE_EMPTY');
    }
    
    return new Comment({
      ...props,
      isPending: isModerated
    });
  }

  /**
   * Callers: [PrismaCommentRepository]
   * Callees: [Comment.constructor]
   * Description: Reconstitutes a Comment entity from persistence without applying creation domain rules.
   * Keywords: load, reconstitute, comment, domain, persistence
   */
  public static load(props: CommentProps): Comment {
    return new Comment(props);
  }

  // --- Accessors ---

  public get id(): string { return this.props.id; }
  public get content(): string { return this.props.content; }
  public get postId(): string { return this.props.postId; }
  public get authorId(): string { return this.props.authorId; }
  public get parentId(): string | null { return this.props.parentId; }
  public get isPending(): boolean { return this.props.isPending; }
  public get deletedAt(): Date | null { return this.props.deletedAt; }
  public get createdAt(): Date { return this.props.createdAt; }

  // --- Domain Behaviors ---

  /**
   * Callers: [CommunityApplicationService.updateComment]
   * Callees: []
   * Description: Updates the comment's content, adjusting the pending status if moderation is required.
   * Keywords: update, comment, content, status, pending
   */
  public updateContent(content: string, isModerated: boolean): void {
    if (content && content.trim().length > 0) this.props.content = content.trim();
    
    if (isModerated) {
      this.props.isPending = true;
    } else if (this.props.isPending) {
      this.props.isPending = false;
    }
  }

  /**
   * Callers: [ModerationApplicationService.approveComment]
   * Callees: []
   * Description: Approves a pending comment, changing its status to false.
   * Keywords: approve, comment, moderation, status
   */
  public approve(): void {
    if (!this.props.isPending) {
      throw new Error('ERR_COMMENT_NOT_PENDING');
    }
    this.props.isPending = false;
  }

  /**
   * Callers: [CommunityApplicationService.deleteComment, ModerationApplicationService.rejectComment]
   * Callees: []
   * Description: Soft deletes the comment by setting deletedAt.
   * Keywords: delete, reject, comment, status, soft
   */
  public delete(): void {
    if (this.props.deletedAt !== null) {
      throw new Error('ERR_COMMENT_ALREADY_DELETED');
    }
    this.props.deletedAt = new Date();
    this.props.isPending = false; // Also clear pending if it was rejected
  }

  /**
   * Callers: [ModerationApplicationService.restoreComment]
   * Callees: []
   * Description: Restores a soft-deleted comment.
   * Keywords: restore, comment, status, soft
   */
  public restore(): void {
    if (this.props.deletedAt === null) {
      throw new Error('ERR_COMMENT_NOT_DELETED');
    }
    this.props.deletedAt = null;
  }
}
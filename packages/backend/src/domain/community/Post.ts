export enum PostStatus {
  PUBLISHED = 'PUBLISHED',
  DRAFT = 'DRAFT',
  ARCHIVED = 'ARCHIVED',
  PENDING_MODERATION = 'PENDING_MODERATION',
  REJECTED = 'REJECTED',
  PENDING = 'PENDING',
  DELETED = 'DELETED'
}

export interface PostProps {
  id: string;
  title: string;
  content: string;
  categoryId: string;
  authorId: string;
  status: PostStatus;
  createdAt: Date;
}

export type CreatePostProps = Omit<PostProps, 'status'>;

/**
 * Callers: [PrismaPostRepository, CommunityApplicationService, ModerationApplicationService]
 * Callees: []
 * Description: Represents the Post Aggregate Root within the Community domain. Manages forum post states and transitions.
 * Keywords: post, aggregate, root, domain, entity, forum, community
 */
export class Post {
  private props: PostProps;

  /**
   * Callers: [Post.create, Post.load, PrismaPostRepository.toDomain]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, post, entity, instantiation
   */
  private constructor(props: PostProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [CommunityApplicationService]
   * Callees: [Post.constructor]
   * Description: Static factory method creating a new Post entity. Validates basic title and content requirements, and sets initial status based on moderation.
   * Keywords: create, factory, post, domain, instantiation
   */
  public static create(props: CreatePostProps, isModerated: boolean): Post {
    if (!props.title || props.title.trim().length === 0) {
      throw new Error('ERR_POST_TITLE_CANNOT_BE_EMPTY');
    }
    if (!props.content || props.content.trim().length === 0) {
      throw new Error('ERR_POST_CONTENT_CANNOT_BE_EMPTY');
    }
    
    const status = isModerated ? PostStatus.PENDING_MODERATION : PostStatus.PUBLISHED;
    
    return new Post({
      ...props,
      status
    });
  }

  /**
   * Callers: [PrismaPostRepository]
   * Callees: [Post.constructor]
   * Description: Reconstitutes a Post entity from persistence without applying creation domain rules.
   * Keywords: load, reconstitute, post, domain, persistence
   */
  public static load(props: PostProps): Post {
    return new Post(props);
  }

  // --- Accessors ---

  public get id(): string { return this.props.id; }
  public get title(): string { return this.props.title; }
  public get content(): string { return this.props.content; }
  public get categoryId(): string { return this.props.categoryId; }
  public get authorId(): string { return this.props.authorId; }
  public get status(): PostStatus { return this.props.status; }
  public get createdAt(): Date { return this.props.createdAt; }

  // --- Domain Behaviors ---

  /**
   * Callers: [CommunityApplicationService.updatePost]
   * Callees: []
   * Description: Updates the post's content and category, adjusting the status to PENDING if moderation is required.
   * Keywords: update, post, content, category, status
   */
  public updateContent(title: string, content: string, categoryId: string, isModerated: boolean): void {
    if (title && title.trim().length > 0) this.props.title = title.trim();
    if (content && content.trim().length > 0) this.props.content = content.trim();
    if (categoryId) this.props.categoryId = categoryId;
    
    if (isModerated) {
      this.props.status = PostStatus.PENDING_MODERATION;
    } else if (this.props.status === 'PENDING' || this.props.status === PostStatus.PENDING_MODERATION) {
      this.props.status = PostStatus.PUBLISHED;
    }
  }

  /**
   * Callers: [ModerationApplicationService.approvePost]
   * Callees: []
   * Description: Approves a pending post, changing its status to PUBLISHED.
   * Keywords: approve, post, moderation, status
   */
  public approve(): void {
    if (this.props.status !== PostStatus.PENDING_MODERATION && this.props.status !== PostStatus.PENDING) {
      throw new Error('ERR_POST_NOT_PENDING');
    }
    this.props.status = PostStatus.PUBLISHED;
  }

  /**
   * Callers: [ModerationApplicationService.rejectPost]
   * Callees: []
   * Description: Rejects a pending post, changing its status to DELETED (soft delete).
   * Keywords: reject, post, moderation, status
   */
  public reject(): void {
    if (this.props.status !== PostStatus.PENDING_MODERATION && this.props.status !== PostStatus.PENDING) {
      throw new Error('ERR_POST_NOT_PENDING');
    }
    this.props.status = PostStatus.REJECTED;
  }

  /**
   * Callers: [ModerationApplicationService.changeStatus]
   * Callees: []
   * Description: Changes the post status directly (e.g. for admin overrides like HIDDEN or PINNED).
   * Keywords: change, status, post, override
   */
  public changeStatus(status: PostStatus): void {
    this.props.status = status;
  }

  /**
   * Callers: [CommunityApplicationService.deletePost]
   * Callees: []
   * Description: Soft deletes the post.
   * Keywords: delete, post, status, soft
   */
  public delete(): void {
    this.props.status = PostStatus.DELETED;
  }

  /**
   * Callers: [ModerationApplicationService.restorePost]
   * Callees: []
   * Description: Restores a soft-deleted post to PUBLISHED status.
   * Keywords: restore, post, status, soft
   */
  public restore(): void {
    if (this.props.status !== PostStatus.DELETED) {
      throw new Error('ERR_POST_NOT_DELETED');
    }
    this.props.status = PostStatus.PUBLISHED;
  }
}
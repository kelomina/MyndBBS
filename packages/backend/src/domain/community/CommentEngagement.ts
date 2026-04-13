export interface CommentUpvoteProps {
  userId: string;
  commentId: string;
  createdAt: Date;
}

export interface CommentBookmarkProps {
  userId: string;
  commentId: string;
  createdAt: Date;
}

/**
 * Callers: [PrismaEngagementRepository, CommunityApplicationService]
 * Callees: []
 * Description: Represents the CommentUpvote Aggregate Root within the Community domain.
 * Keywords: commentupvote, upvote, comment, engagement, aggregate, root, domain, entity
 */
export class CommentUpvote {
  private props: CommentUpvoteProps;

  /**
   * Callers: [CommentUpvote.create, CommentUpvote.load]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, commentupvote, entity, instantiation
   */
  private constructor(props: CommentUpvoteProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [CommunityApplicationService.toggleCommentUpvote]
   * Callees: [CommentUpvote.constructor]
   * Description: Static factory method creating a new CommentUpvote entity.
   * Keywords: create, factory, commentupvote, domain, instantiation
   */
  public static create(props: CommentUpvoteProps): CommentUpvote {
    if (!props.userId || !props.commentId) {
      throw new Error('ERR_COMMENT_UPVOTE_MISSING_REQUIRED_FIELDS');
    }
    return new CommentUpvote(props);
  }

  /**
   * Callers: [PrismaEngagementRepository.findCommentUpvote]
   * Callees: [CommentUpvote.constructor]
   * Description: Static factory method reconstituting a CommentUpvote entity from database state.
   * Keywords: load, factory, commentupvote, domain, reconstitute
   */
  public static load(props: CommentUpvoteProps): CommentUpvote {
    return new CommentUpvote(props);
  }

  public get userId(): string { return this.props.userId; }
  public get commentId(): string { return this.props.commentId; }
  public get createdAt(): Date { return this.props.createdAt; }
}

/**
 * Callers: [PrismaEngagementRepository, CommunityApplicationService]
 * Callees: []
 * Description: Represents the CommentBookmark Aggregate Root within the Community domain.
 * Keywords: commentbookmark, bookmark, comment, engagement, aggregate, root, domain, entity
 */
export class CommentBookmark {
  private props: CommentBookmarkProps;

  /**
   * Callers: [CommentBookmark.create, CommentBookmark.load]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, commentbookmark, entity, instantiation
   */
  private constructor(props: CommentBookmarkProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [CommunityApplicationService.toggleCommentBookmark]
   * Callees: [CommentBookmark.constructor]
   * Description: Static factory method creating a new CommentBookmark entity.
   * Keywords: create, factory, commentbookmark, domain, instantiation
   */
  public static create(props: CommentBookmarkProps): CommentBookmark {
    if (!props.userId || !props.commentId) {
      throw new Error('ERR_COMMENT_BOOKMARK_MISSING_REQUIRED_FIELDS');
    }
    return new CommentBookmark(props);
  }

  /**
   * Callers: [PrismaEngagementRepository.findCommentBookmark]
   * Callees: [CommentBookmark.constructor]
   * Description: Static factory method reconstituting a CommentBookmark entity from database state.
   * Keywords: load, factory, commentbookmark, domain, reconstitute
   */
  public static load(props: CommentBookmarkProps): CommentBookmark {
    return new CommentBookmark(props);
  }

  public get userId(): string { return this.props.userId; }
  public get commentId(): string { return this.props.commentId; }
  public get createdAt(): Date { return this.props.createdAt; }
}
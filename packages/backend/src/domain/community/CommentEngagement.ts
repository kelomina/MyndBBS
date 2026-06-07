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
 * 类名称：CommentUpvote
 *
 * 函数作用：
 *   社区域中的评论点赞聚合根。
 * Purpose:
 *   CommentUpvote Aggregate Root within the Community domain.
 *
 * 中文关键词：
 *   评论点赞，聚合根
 * English keywords:
 *   comment upvote, aggregate root
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
 * 类名称：CommentBookmark
 *
 * 函数作用：
 *   社区域中的评论书签聚合根。
 * Purpose:
 *   CommentBookmark Aggregate Root within the Community domain.
 *
 * 中文关键词：
 *   评论书签，聚合根
 * English keywords:
 *   comment bookmark, aggregate root
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
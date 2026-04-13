export interface PostUpvoteProps {
  userId: string;
  postId: string;
  createdAt: Date;
}

export interface PostBookmarkProps {
  userId: string;
  postId: string;
  createdAt: Date;
}

/**
 * Callers: [PrismaEngagementRepository, CommunityApplicationService]
 * Callees: []
 * Description: Represents the PostUpvote Aggregate Root within the Community domain.
 * Keywords: postupvote, upvote, post, engagement, aggregate, root, domain, entity
 */
export class PostUpvote {
  private props: PostUpvoteProps;

  /**
   * Callers: [PostUpvote.create, PostUpvote.load]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, postupvote, entity, instantiation
   */
  private constructor(props: PostUpvoteProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [CommunityApplicationService.togglePostUpvote]
   * Callees: [PostUpvote.constructor]
   * Description: Static factory method creating a new PostUpvote entity.
   * Keywords: create, factory, postupvote, domain, instantiation
   */
  public static create(props: PostUpvoteProps): PostUpvote {
    if (!props.userId || !props.postId) {
      throw new Error('ERR_POST_UPVOTE_MISSING_REQUIRED_FIELDS');
    }
    return new PostUpvote(props);
  }

  /**
   * Callers: [PrismaEngagementRepository.findPostUpvote]
   * Callees: [PostUpvote.constructor]
   * Description: Static factory method reconstituting a PostUpvote entity from database state.
   * Keywords: load, factory, postupvote, domain, reconstitute
   */
  public static load(props: PostUpvoteProps): PostUpvote {
    return new PostUpvote(props);
  }

  public get userId(): string { return this.props.userId; }
  public get postId(): string { return this.props.postId; }
  public get createdAt(): Date { return this.props.createdAt; }
}

/**
 * Callers: [PrismaEngagementRepository, CommunityApplicationService]
 * Callees: []
 * Description: Represents the PostBookmark Aggregate Root within the Community domain.
 * Keywords: postbookmark, bookmark, post, engagement, aggregate, root, domain, entity
 */
export class PostBookmark {
  private props: PostBookmarkProps;

  /**
   * Callers: [PostBookmark.create, PostBookmark.load]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, postbookmark, entity, instantiation
   */
  private constructor(props: PostBookmarkProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [CommunityApplicationService.togglePostBookmark]
   * Callees: [PostBookmark.constructor]
   * Description: Static factory method creating a new PostBookmark entity.
   * Keywords: create, factory, postbookmark, domain, instantiation
   */
  public static create(props: PostBookmarkProps): PostBookmark {
    if (!props.userId || !props.postId) {
      throw new Error('ERR_POST_BOOKMARK_MISSING_REQUIRED_FIELDS');
    }
    return new PostBookmark(props);
  }

  /**
   * Callers: [PrismaEngagementRepository.findPostBookmark]
   * Callees: [PostBookmark.constructor]
   * Description: Static factory method reconstituting a PostBookmark entity from database state.
   * Keywords: load, factory, postbookmark, domain, reconstitute
   */
  public static load(props: PostBookmarkProps): PostBookmark {
    return new PostBookmark(props);
  }

  public get userId(): string { return this.props.userId; }
  public get postId(): string { return this.props.postId; }
  public get createdAt(): Date { return this.props.createdAt; }
}
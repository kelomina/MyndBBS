/**
 * Callers: [CommunityApplicationService]
 * Callees: []
 * Description: The repository interface for managing user engagements (upvotes, bookmarks) on posts and comments.
 * Keywords: engagement, repository, interface, contract, upvote, bookmark
 */
export interface IEngagementRepository {
  /**
   * Callers: [CommunityApplicationService]
   * Callees: []
   * Description: Toggles an upvote on a post for a specific user.
   * Keywords: toggle, upvote, post, repository
   */
  togglePostUpvote(postId: string, userId: string): Promise<boolean>;

  /**
   * Callers: [CommunityApplicationService]
   * Callees: []
   * Description: Toggles a bookmark on a post for a specific user.
   * Keywords: toggle, bookmark, post, repository
   */
  togglePostBookmark(postId: string, userId: string): Promise<boolean>;

  /**
   * Callers: [CommunityApplicationService]
   * Callees: []
   * Description: Toggles an upvote on a comment for a specific user.
   * Keywords: toggle, upvote, comment, repository
   */
  toggleCommentUpvote(commentId: string, userId: string): Promise<boolean>;

  /**
   * Callers: [CommunityApplicationService]
   * Callees: []
   * Description: Toggles a bookmark on a comment for a specific user.
   * Keywords: toggle, bookmark, comment, repository
   */
  toggleCommentBookmark(commentId: string, userId: string): Promise<boolean>;
}

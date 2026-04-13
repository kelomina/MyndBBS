import { PostUpvote, PostBookmark } from './PostEngagement';
import { CommentUpvote, CommentBookmark } from './CommentEngagement';

/**
 * Callers: [CommunityApplicationService]
 * Callees: []
 * Description: The repository interface for managing user engagements (upvotes, bookmarks) via domain entities.
 * Keywords: engagement, repository, interface, contract, upvote, bookmark
 */
export interface IEngagementRepository {
  findPostUpvote(postId: string, userId: string): Promise<PostUpvote | null>;
  savePostUpvote(upvote: PostUpvote): Promise<void>;
  deletePostUpvote(postId: string, userId: string): Promise<void>;

  findPostBookmark(postId: string, userId: string): Promise<PostBookmark | null>;
  savePostBookmark(bookmark: PostBookmark): Promise<void>;
  deletePostBookmark(postId: string, userId: string): Promise<void>;

  findCommentUpvote(commentId: string, userId: string): Promise<CommentUpvote | null>;
  saveCommentUpvote(upvote: CommentUpvote): Promise<void>;
  deleteCommentUpvote(commentId: string, userId: string): Promise<void>;

  findCommentBookmark(commentId: string, userId: string): Promise<CommentBookmark | null>;
  saveCommentBookmark(bookmark: CommentBookmark): Promise<void>;
  deleteCommentBookmark(commentId: string, userId: string): Promise<void>;
}

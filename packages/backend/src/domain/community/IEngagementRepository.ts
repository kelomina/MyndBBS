import { PostUpvote, PostBookmark } from './PostEngagement';
import { CommentUpvote, CommentBookmark } from './CommentEngagement';

/**
 * 接口名称：IEngagementRepository
 *
 * 函数作用：
 *   用户互动（点赞、书签）的仓储接口。
 * Purpose:
 *   Repository interface for user engagements (upvotes, bookmarks).
 *
 * 中文关键词：
 *   互动，点赞，书签，仓储接口
 * English keywords:
 *   engagement, upvote, bookmark, repository interface
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

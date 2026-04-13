import { IEngagementRepository } from '../../domain/community/IEngagementRepository';
import { PostUpvote, PostBookmark } from '../../domain/community/PostEngagement';
import { CommentUpvote, CommentBookmark } from '../../domain/community/CommentEngagement';
import { prisma } from '../../db';

/**
 * Callers: [CommunityApplicationService.constructor]
 * Callees: [prisma.upvote, prisma.bookmark, prisma.commentUpvote, prisma.commentBookmark]
 * Description: The Prisma-based implementation of the IEngagementRepository, managing standalone engagement aggregates.
 * Keywords: prisma, engagement, repository, upvote, bookmark, infrastructure
 */
export class PrismaEngagementRepository implements IEngagementRepository {
  
  // --- Post Upvote ---
  public async findPostUpvote(postId: string, userId: string): Promise<PostUpvote | null> {
    const raw = await prisma.upvote.findUnique({ where: { userId_postId: { userId, postId } } });
    if (!raw) return null;
    return PostUpvote.load({ userId: raw.userId, postId: raw.postId, createdAt: raw.createdAt });
  }

  public async savePostUpvote(upvote: PostUpvote): Promise<void> {
    await prisma.upvote.upsert({
      where: { userId_postId: { userId: upvote.userId, postId: upvote.postId } },
      create: { userId: upvote.userId, postId: upvote.postId, createdAt: upvote.createdAt },
      update: {}
    });
  }

  public async deletePostUpvote(postId: string, userId: string): Promise<void> {
    await prisma.upvote.delete({ where: { userId_postId: { userId, postId } } });
  }

  // --- Post Bookmark ---
  public async findPostBookmark(postId: string, userId: string): Promise<PostBookmark | null> {
    const raw = await prisma.bookmark.findUnique({ where: { userId_postId: { userId, postId } } });
    if (!raw) return null;
    return PostBookmark.load({ userId: raw.userId, postId: raw.postId, createdAt: raw.createdAt });
  }

  public async savePostBookmark(bookmark: PostBookmark): Promise<void> {
    await prisma.bookmark.upsert({
      where: { userId_postId: { userId: bookmark.userId, postId: bookmark.postId } },
      create: { userId: bookmark.userId, postId: bookmark.postId, createdAt: bookmark.createdAt },
      update: {}
    });
  }

  public async deletePostBookmark(postId: string, userId: string): Promise<void> {
    await prisma.bookmark.delete({ where: { userId_postId: { userId, postId } } });
  }

  // --- Comment Upvote ---
  public async findCommentUpvote(commentId: string, userId: string): Promise<CommentUpvote | null> {
    const raw = await prisma.commentUpvote.findUnique({ where: { userId_commentId: { userId, commentId } } });
    if (!raw) return null;
    return CommentUpvote.load({ userId: raw.userId, commentId: raw.commentId, createdAt: raw.createdAt });
  }

  public async saveCommentUpvote(upvote: CommentUpvote): Promise<void> {
    await prisma.commentUpvote.upsert({
      where: { userId_commentId: { userId: upvote.userId, commentId: upvote.commentId } },
      create: { userId: upvote.userId, commentId: upvote.commentId, createdAt: upvote.createdAt },
      update: {}
    });
  }

  public async deleteCommentUpvote(commentId: string, userId: string): Promise<void> {
    await prisma.commentUpvote.delete({ where: { userId_commentId: { userId, commentId } } });
  }

  // --- Comment Bookmark ---
  public async findCommentBookmark(commentId: string, userId: string): Promise<CommentBookmark | null> {
    const raw = await prisma.commentBookmark.findUnique({ where: { userId_commentId: { userId, commentId } } });
    if (!raw) return null;
    return CommentBookmark.load({ userId: raw.userId, commentId: raw.commentId, createdAt: raw.createdAt });
  }

  public async saveCommentBookmark(bookmark: CommentBookmark): Promise<void> {
    await prisma.commentBookmark.upsert({
      where: { userId_commentId: { userId: bookmark.userId, commentId: bookmark.commentId } },
      create: { userId: bookmark.userId, commentId: bookmark.commentId, createdAt: bookmark.createdAt },
      update: {}
    });
  }

  public async deleteCommentBookmark(commentId: string, userId: string): Promise<void> {
    await prisma.commentBookmark.delete({ where: { userId_commentId: { userId, commentId } } });
  }
}

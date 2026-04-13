import { IEngagementRepository } from '../../domain/community/IEngagementRepository';
import { prisma } from '../../db';

/**
 * Callers: [CommunityApplicationService.constructor]
 * Callees: [prisma.upvote, prisma.bookmark, prisma.commentUpvote, prisma.commentBookmark]
 * Description: The Prisma-based implementation of the IEngagementRepository, managing many-to-many engagement toggles.
 * Keywords: prisma, engagement, repository, upvote, bookmark, infrastructure
 */
export class PrismaEngagementRepository implements IEngagementRepository {
  
  private async toggle(modelDelegate: any, whereCondition: any, createData: any): Promise<boolean> {
    const existing = await modelDelegate.findUnique({ where: whereCondition });
    if (existing) {
      await modelDelegate.delete({ where: whereCondition });
      return false; // Toggled off
    } else {
      await modelDelegate.create({ data: createData });
      return true; // Toggled on
    }
  }

  public async togglePostUpvote(postId: string, userId: string): Promise<boolean> {
    return this.toggle(
      prisma.upvote,
      { userId_postId: { userId, postId } },
      { userId, postId }
    );
  }

  public async togglePostBookmark(postId: string, userId: string): Promise<boolean> {
    return this.toggle(
      prisma.bookmark,
      { userId_postId: { userId, postId } },
      { userId, postId }
    );
  }

  public async toggleCommentUpvote(commentId: string, userId: string): Promise<boolean> {
    return this.toggle(
      prisma.commentUpvote,
      { userId_commentId: { userId, commentId } },
      { userId, commentId }
    );
  }

  public async toggleCommentBookmark(commentId: string, userId: string): Promise<boolean> {
    return this.toggle(
      prisma.commentBookmark,
      { userId_commentId: { userId, commentId } },
      { userId, commentId }
    );
  }
}

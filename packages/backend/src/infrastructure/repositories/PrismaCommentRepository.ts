/**
 * 类名称：PrismaCommentRepository
 *
 * 函数作用：
 *   Prisma 实现的评论仓储，映射 Prisma 行记录到领域 Comment 聚合根。
 * Purpose:
 *   Prisma-based Comment repository, mapping Prisma rows to the Comment domain aggregate root.
 *
 * 调用方 / Called by:
 *   - CommunityApplicationService
 *   - ModerationApplicationService
 *   - registry.ts
 *
 * 中文关键词：
 *   Prisma，评论，仓储实现
 * English keywords:
 *   Prisma, comment, repository implementation
 */
import { ICommentRepository } from '../../domain/community/ICommentRepository';
import { Comment, CommentProps } from '../../domain/community/Comment';
import { prisma } from '../../db';

export class PrismaCommentRepository implements ICommentRepository {
  /**
   * 函数名称：toDomain
   *
   * 函数作用：
   *   将 Prisma 原始行记录映射为领域 Comment 聚合根。
   * Purpose:
   *   Maps a raw Prisma row to the Comment domain aggregate root.
   */
  private toDomain(raw: any): Comment {
    const props: CommentProps = {
      id: raw.id,
      content: raw.content,
      postId: raw.postId,
      authorId: raw.authorId,
      parentId: raw.parentId,
      isPending: raw.isPending,
      deletedAt: raw.deletedAt,
      createdAt: raw.createdAt,
    };
    return Comment.load(props);
  }

  /**
   * 函数名称：findById
   *
   * 函数作用：
   *   按 ID 查找评论。
   * Purpose:
   *   Finds a comment by ID.
   */
  public async findById(id: string): Promise<Comment | null> {
    const raw = await prisma.comment.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  /**
   * 函数名称：save
   *
   * 函数作用：
   *   创建或更新评论（upsert）。
   * Purpose:
   *   Creates or updates a comment (upsert).
   */
  public async save(comment: Comment): Promise<void> {
    await prisma.comment.upsert({
      where: { id: comment.id },
      create: {
        id: comment.id,
        content: comment.content,
        postId: comment.postId,
        authorId: comment.authorId,
        parentId: comment.parentId,
        isPending: comment.isPending,
        deletedAt: comment.deletedAt,
        createdAt: comment.createdAt,
      },
      update: {
        content: comment.content,
        isPending: comment.isPending,
        deletedAt: comment.deletedAt,
      },
    });
  }

  /**
   * 函数名称：delete
   *
   * 函数作用：
   *   从数据库中永久删除评论。
   * Purpose:
   *   Permanently deletes a comment from the database.
   */
  public async delete(id: string): Promise<void> {
    await prisma.comment.delete({ where: { id } });
  }

  /**
   * 函数名称：softDeleteManyByPostId
   *
   * 函数作用：
   *   软删除指定帖子下的全部评论（设置 deletedAt）。
   * Purpose:
   *   Soft-deletes all comments under a post by setting deletedAt.
   */
  public async softDeleteManyByPostId(postId: string): Promise<void> {
    await prisma.comment.updateMany({
      where: { postId },
      data: { deletedAt: new Date() }
    });
  }
}

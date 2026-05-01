/**
 * 类名称：PrismaPostRepository
 *
 * 函数作用：
 *   Prisma 实现的帖子仓储，在 Prisma 行记录和领域 Post 聚合根之间做映射。
 * Purpose:
 *   Prisma-based Post repository, mapping between Prisma rows and the Post domain aggregate root.
 *
 * 调用方 / Called by:
 *   - CommunityApplicationService
 *   - ModerationApplicationService
 *   - registry.ts
 *
 * 中文关键词：
 *   Prisma，帖子，仓储实现
 * English keywords:
 *   Prisma, post, repository implementation
 */
import { IPostRepository } from '../../domain/community/IPostRepository';
import { Post, PostProps } from '../../domain/community/Post';
import { prisma } from '../../db';

export class PrismaPostRepository implements IPostRepository {
  /**
   * 函数名称：toDomain
   *
   * 函数作用：
   *   将 Prisma 原始行记录映射为领域 Post 聚合根。
   * Purpose:
   *   Maps a raw Prisma row to the Post domain aggregate root.
   *
   * 调用方 / Called by:
   *   - findById
   *
   * 参数说明 / Parameters:
   *   - raw: any, Prisma 查询返回的原始帖子数据
   *
   * 返回值说明 / Returns:
   *   Post 领域实体
   *
   * 中文关键词：
   行转领域，帖子映射
   * English keywords:
   *   row to domain, post mapping
   */
  private toDomain(raw: any): Post {
    const props: PostProps = {
      id: raw.id,
      title: raw.title,
      content: raw.content,
      categoryId: raw.categoryId,
      authorId: raw.authorId,
      status: raw.status,
      createdAt: raw.createdAt,
    };
    return Post.load(props);
  }

  /**
   * 函数名称：findById
   *
   * 函数作用：
   *   按 ID 查找帖子。
   * Purpose:
   *   Finds a post by its ID.
   *
   * 调用方 / Called by:
   *   - CommunityApplicationService
   *   - ModerationApplicationService
   *
   * 参数说明 / Parameters:
   *   - id: string, 帖子 ID
   *
   * 返回值说明 / Returns:
   *   Post | null
   *
   * 中文关键词：
   按 ID 查询帖子
   * English keywords:
   *   find post by ID
   */
  public async findById(id: string): Promise<Post | null> {
    const raw = await prisma.post.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  /**
   * 函数名称：save
   *
   * 函数作用：
   *   创建或更新帖子（upsert）。
   * Purpose:
   *   Creates or updates a post (upsert).
   *
   * 调用方 / Called by:
   *   - CommunityApplicationService
   *   - ModerationApplicationService
   *
   * 参数说明 / Parameters:
   *   - post: Post, 要持久化的帖子领域实体
   *
   * 中文关键词：
   保存，创建，更新帖子
   * English keywords:
   *   save, create, update post
   */
  public async save(post: Post): Promise<void> {
    await prisma.post.upsert({
      where: { id: post.id },
      create: {
        id: post.id,
        title: post.title,
        content: post.content,
        categoryId: post.categoryId,
        authorId: post.authorId,
        status: post.status as any, // Cast domain status to Prisma status
        createdAt: post.createdAt,
      },
      update: {
        title: post.title,
        content: post.content,
        categoryId: post.categoryId,
        status: post.status as any, // Cast domain status to Prisma status
      },
    });
  }

  /**
   * 函数名称：delete
   *
   * 函数作用：
   *   从数据库中永久删除帖子。
   * Purpose:
   *   Permanently deletes a post from the database.
   *
   * 参数说明 / Parameters:
   *   - id: string, 帖子 ID
   *
   * 中文关键词：
   永久删除帖子
   * English keywords:
   *   hard delete post
   */
  public async delete(id: string): Promise<void> {
    await prisma.post.delete({ where: { id } });
  }

  /**
   * 函数名称：deleteManyByCategoryId
   *
   * 函数作用：
   *   删除指定分类下的全部帖子。
   * Purpose:
   *   Deletes all posts under a specific category.
   *
   * 调用方 / Called by:
   *   CommunityApplicationService.deleteCategory
   *
   * 参数说明 / Parameters:
   *   - categoryId: string, 分类 ID
   *
   * 中文关键词：
   批量删除帖子，按分类
   * English keywords:
   *   delete posts by category
   */
  public async deleteManyByCategoryId(categoryId: string): Promise<void> {
    await prisma.post.deleteMany({ where: { categoryId } });
  }
}

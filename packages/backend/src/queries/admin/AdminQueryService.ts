import { prisma } from '../../db';
import { accessibleBy } from '@casl/prisma';
import type { AppAbility } from '../../lib/casl';
import { PostStatus, UserStatus } from '@prisma/client';

import { AdminUserListDTO, AdminCategoryListDTO, AdminPostListDTO, AdminDeletedPostListDTO, AdminDeletedCommentListDTO } from './dto';

/**
 * Callers: [adminController, moderationController]
 * Callees: [prisma.user, prisma.category, prisma.post, prisma.comment, prisma.moderatedWord]
 * Description: Query service for administrative and moderation read operations (users, categories, deleted items, pending items).
 * Keywords: query, service, admin, moderation, users, categories, posts, comments
 */
export class AdminQueryService {
  /**
   * Callers: [adminController.getUsers]
   * Callees: [prisma.user.findMany]
   * Description: Lists all users with their roles for the admin panel.
   * Keywords: admin, users, list
   */
  public async listUsers(): Promise<AdminUserListDTO[]> {
    const users = await prisma.user.findMany({
      take: 1000,
      select: { id: true, username: true, email: true, role: { select: { id: true, name: true } }, status: true, level: true },
    });
    return users.map((u) => ({ ...u, role: u.role || null }));
  }

  /**
   * Callers: [adminController.getCategories]
   * Callees: [prisma.category.findMany]
   * Description: Lists all categories ordered by sortOrder.
   * Keywords: admin, categories, list
   */
  public async listCategories(): Promise<AdminCategoryListDTO[]> {
    return prisma.category.findMany({ take: 1000, orderBy: { sortOrder: 'asc' } });
  }

  /**
   * Callers: [adminController.getPosts]
   * Callees: [accessibleBy, prisma.post.findMany]
   * Description: Lists all accessible posts for the admin panel.
   * Keywords: admin, posts, list
   */
  public async listPosts(ability: AppAbility): Promise<AdminPostListDTO[]> {
    const posts = await prisma.post.findMany({
      take: 1000,
      where: accessibleBy(ability, 'read').Post,
      include: { author: { select: { id: true, username: true } }, category: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return posts.map(p => ({
      id: p.id,
      title: p.title,
      status: p.status,
      author: p.author,
      category: p.category,
      createdAt: p.createdAt,
    }));
  }

  public async listDeletedPosts(ability: AppAbility): Promise<AdminDeletedPostListDTO[]> {
    const posts = await prisma.post.findMany({
      take: 1000,
      where: { AND: [accessibleBy(ability, 'manage').Post, { status: PostStatus.DELETED }] },
      include: { author: { select: { id: true, username: true } }, category: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return posts.map(p => ({
      id: p.id,
      title: p.title,
      status: p.status,
      author: p.author,
      category: p.category,
      createdAt: p.createdAt,
    }));
  }

  /**
   * Callers: [adminController.updatePostStatus, adminController.restorePost, adminController.hardDeletePost]
   * Callees: [prisma.post.findUnique]
   * Description: Fetches a post by ID for administrative operations.
   * Keywords: admin, post, get
   */
  public async getPostById(id: string) {
    return prisma.post.findUnique({ where: { id } });
  }

  /**
   * Callers: [adminController.getDeletedComments]
   * Callees: [prisma.comment.findMany]
   * Description: Lists all logically deleted comments for the admin panel.
   * Keywords: admin, deleted, comments, list
   */
  public async listDeletedComments(ability: AppAbility): Promise<AdminDeletedCommentListDTO[]> {
    const comments = await prisma.comment.findMany({
      take: 1000,
      where: {
        AND: [
          accessibleBy(ability, 'manage').Comment,
          { deletedAt: { not: null } }
        ]
      },
      include: { author: { select: { id: true, username: true } }, post: { select: { id: true, title: true } } },
      orderBy: { deletedAt: 'desc' }
    });
    return comments.map(c => ({
      id: c.id,
      content: c.content,
      author: c.author,
      post: c.post,
      createdAt: c.createdAt,
    }));
  }

  /**
   * Callers: [adminController.restoreComment, adminController.hardDeleteComment]
   * Callees: [prisma.comment.findUnique]
   * Description: Fetches a comment by ID for administrative operations, including its post.
   * Keywords: admin, comment, get, post
   */
  public async getCommentWithPost(id: string) {
    return prisma.comment.findUnique({
      where: { id },
      include: { post: true }
    });
  }

  /**
   * Callers: [listModeratedWords, listPendingPosts, listPendingComments]
   * Callees: [prisma.user.findUnique]
   * Description: Helper method to get the moderation scope (category IDs) for a user.
   * Keywords: moderation, scope, categories, user
   */
  public async getModeratorScope(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true, moderatedCategories: true } });
    const isSuperAdmin = user?.role?.name === 'SUPER_ADMIN' || user?.role?.name === 'ADMIN';
    const categoryIds = isSuperAdmin ? undefined : user?.moderatedCategories.map((c) => c.categoryId);
    return { isSuperAdmin, categoryIds };
  }

  /**
   * Callers: [moderationController.getModeratedWords]
   * Callees: [getModeratorScope, prisma.moderatedWord.findMany]
   * Description: Lists moderated words visible to the current moderator/admin.
   * Keywords: moderation, words, list
   */
  public async listModeratedWords(userId: string) {
    const { categoryIds } = await this.getModeratorScope(userId);
    return prisma.moderatedWord.findMany({
      take: 1000,
      where: categoryIds
        ? { OR: [{ categoryId: null }, { categoryId: { in: categoryIds } }] }
        : {},
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Callers: [moderationController.getPendingPosts]
   * Callees: [getModeratorScope, prisma.post.findMany]
   * Description: Lists pending posts requiring moderation within the user's scope.
   * Keywords: moderation, pending, posts, list
   */
  public async listPendingPosts(userId: string) {
    const { categoryIds } = await this.getModeratorScope(userId);
    return prisma.post.findMany({
      take: 1000,
      where: { status: 'PENDING', ...(categoryIds ? { categoryId: { in: categoryIds } } : {}) },
      include: { author: { select: { username: true } }, category: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Callers: [moderationController.getPendingComments]
   * Callees: [getModeratorScope, prisma.comment.findMany]
   * Description: Lists pending comments requiring moderation within the user's scope.
   * Keywords: moderation, pending, comments, list
   */
  public async listPendingComments(userId: string) {
    const { categoryIds } = await this.getModeratorScope(userId);
    return prisma.comment.findMany({
      take: 1000,
      where: {
        isPending: true,
        deletedAt: null,
        ...(categoryIds ? { post: { categoryId: { in: categoryIds } } } : {}),
      },
      include: { author: { select: { username: true } }, post: { select: { title: true, id: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async getModeratedWordById(id: string) {
    return prisma.moderatedWord.findUnique({ where: { id } });
  }

  public async getRoleByName(name: string) {
    return prisma.role.findUnique({ where: { name } });
  }

  public async getRootUser() {
    return prisma.user.findFirst({
      where: { username: 'root', status: { not: UserStatus.BANNED as any } }
    });
  }
}

export const adminQueryService = new AdminQueryService();
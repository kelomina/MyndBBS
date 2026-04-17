import { prisma } from '../../db';
import { rulesToPrisma } from '../../lib/rulesToPrisma';
import type { AppAbility } from '../../lib/casl';
import { PostStatus, UserStatus } from '@myndbbs/shared';

import { AdminUserListDTO, AdminCategoryListDTO, AdminPostListDTO, AdminDeletedPostListDTO, AdminDeletedCommentListDTO, AdminPostDTO, AdminCommentWithPostDTO, AdminModeratorScopeDTO, AdminModeratedWordListDTO, AdminPendingPostListDTO, AdminPendingCommentListDTO, AdminModeratedWordDTO, AdminRoleDTO, AdminUserDTO } from './dto';

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
      where: rulesToPrisma(ability, 'read', 'Post'),
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
      where: { AND: [rulesToPrisma(ability, 'manage', 'Post'), { status: PostStatus.DELETED }] },
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
  public async getPostById(id: string): Promise<AdminPostDTO | null> {
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return null;
    return {
      id: post.id,
      title: post.title,
      content: post.content,
      authorId: post.authorId,
      categoryId: post.categoryId,
      status: post.status,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
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
          rulesToPrisma(ability, 'manage', 'Comment'),
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
  public async getCommentWithPost(id: string): Promise<AdminCommentWithPostDTO | null> {
    const comment = await prisma.comment.findUnique({
      where: { id },
      include: { post: true }
    });
    if (!comment) return null;
    return {
      id: comment.id,
      content: comment.content,
      postId: comment.postId,
      authorId: comment.authorId,
      parentId: comment.parentId,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      deletedAt: comment.deletedAt,
      isPending: comment.isPending,
      post: {
        id: comment.post.id,
        title: comment.post.title,
        content: comment.post.content,
        authorId: comment.post.authorId,
        categoryId: comment.post.categoryId,
        status: comment.post.status,
        createdAt: comment.post.createdAt,
        updatedAt: comment.post.updatedAt,
      }
    };
  }

  /**
   * Callers: [listModeratedWords, listPendingPosts, listPendingComments]
   * Callees: [prisma.user.findUnique]
   * Description: Helper method to get the moderation scope (category IDs) for a user.
   * Keywords: moderation, scope, categories, user
   */
  public async getModeratorScope(userId: string): Promise<AdminModeratorScopeDTO> {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true, moderatedCategories: true } });
    const isSuperAdmin = user?.role?.name === 'SUPER_ADMIN' || user?.role?.name === 'ADMIN';
    const result: AdminModeratorScopeDTO = { isSuperAdmin };
    if (!isSuperAdmin) {
      result.categoryIds = user?.moderatedCategories.map((c) => c.categoryId) || [];
    }
    return result;
  }

  /**
   * Callers: [moderationController.getModeratedWords]
   * Callees: [getModeratorScope, prisma.moderatedWord.findMany]
   * Description: Lists moderated words visible to the current moderator/admin.
   * Keywords: moderation, words, list
   */
  public async listModeratedWords(userId: string): Promise<AdminModeratedWordListDTO[]> {
    const { categoryIds } = await this.getModeratorScope(userId);
    const words = await prisma.moderatedWord.findMany({
      take: 1000,
      where: categoryIds
        ? { OR: [{ categoryId: null }, { categoryId: { in: categoryIds } }] }
        : {},
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return words.map(w => ({
      id: w.id,
      word: w.word,
      categoryId: w.categoryId,
      createdAt: w.createdAt,
      category: w.category ? { name: w.category.name } : null
    }));
  }

  /**
   * Callers: [moderationController.getPendingPosts]
   * Callees: [getModeratorScope, prisma.post.findMany]
   * Description: Lists pending posts requiring moderation within the user's scope.
   * Keywords: moderation, pending, posts, list
   */
  public async listPendingPosts(userId: string): Promise<AdminPendingPostListDTO[]> {
    const { categoryIds } = await this.getModeratorScope(userId);
    const posts = await prisma.post.findMany({
      take: 1000,
      where: { status: 'PENDING', ...(categoryIds ? { categoryId: { in: categoryIds } } : {}) },
      include: { author: { select: { username: true } }, category: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return posts.map(p => ({
      id: p.id,
      title: p.title,
      content: p.content,
      status: p.status,
      createdAt: p.createdAt,
      author: { username: p.author.username },
      category: { name: p.category.name }
    }));
  }

  /**
   * Callers: [moderationController.getPendingComments]
   * Callees: [getModeratorScope, prisma.comment.findMany]
   * Description: Lists pending comments requiring moderation within the user's scope.
   * Keywords: moderation, pending, comments, list
   */
  public async listPendingComments(userId: string): Promise<AdminPendingCommentListDTO[]> {
    const { categoryIds } = await this.getModeratorScope(userId);
    const comments = await prisma.comment.findMany({
      take: 1000,
      where: {
        isPending: true,
        deletedAt: null,
        ...(categoryIds ? { post: { categoryId: { in: categoryIds } } } : {}),
      },
      include: { author: { select: { username: true } }, post: { select: { title: true, id: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return comments.map(c => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      author: { username: c.author.username },
      post: { id: c.post.id, title: c.post.title }
    }));
  }

  public async getModeratedWordById(id: string): Promise<AdminModeratedWordDTO | null> {
    const word = await prisma.moderatedWord.findUnique({ where: { id } });
    if (!word) return null;
    return {
      id: word.id,
      word: word.word,
      categoryId: word.categoryId,
      createdAt: word.createdAt,
    };
  }

  public async getRoleByName(name: string): Promise<AdminRoleDTO | null> {
    const role = await prisma.role.findUnique({ where: { name } });
    if (!role) return null;
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  public async getRootUser(): Promise<AdminUserDTO | null> {
    const user = await prisma.user.findFirst({
      where: { username: 'root', status: { not: UserStatus.BANNED as any } }
    });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      status: user.status,
      level: user.level,
      roleId: user.roleId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

export const adminQueryService = new AdminQueryService();
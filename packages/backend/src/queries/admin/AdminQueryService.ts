import { prisma } from '../../db';
import { rulesToPrisma } from '../../lib/rulesToPrisma';
import type { AppAbility } from '../../lib/casl';
import { PostStatus, UserStatus } from '@myndbbs/shared';

import { AdminUserListDTO, AdminCategoryListDTO, AdminPostListDTO, AdminDeletedPostListDTO, AdminDeletedCommentListDTO, AdminPostDTO, AdminCommentWithPostDTO, AdminModeratorScopeDTO, AdminModeratedWordListDTO, AdminPendingPostListDTO, AdminPendingCommentListDTO, AdminModeratedWordDTO, AdminRoleDTO, AdminUserDTO } from './dto';

/**
 * 类名称：AdminQueryService
 *
 * 函数作用：
 *   管理后台和内容审核的查询服务，封装 Prisma 读取操作并返回 DTO。
 * Purpose:
 *   Query service for admin panel and content moderation, wrapping Prisma read operations and returning DTOs.
 *
 * 调用方 / Called by:
 *   - adminController
 *   - moderationController
 *
 * 中文关键词：
 *   管理，审核，查询，用户，分类，帖子，评论
 * English keywords:
 *   admin, moderation, query, users, categories, posts, comments
 */
export class AdminQueryService {
  /**
   * 函数名称：listUsers
   *
   * 函数作用：
   *   获取用户列表，支持按用户名或邮箱关键字模糊搜索。
   * Purpose:
   *   Lists all users with optional keyword search on username or email.
   *
   * 调用方 / Called by:
   *   adminController.getUsers → GET /api/admin/users
   *
   * 参数说明 / Parameters:
   *   - query: string | undefined, 搜索关键字（匹配用户名或邮箱，大小写不敏感）
   *
   * 返回值说明 / Returns:
   *   AdminUserListDTO[] 用户列表
   *
   * 副作用 / Side effects:
   *   无——只读查询
   *
   * 中文关键词：
   *   用户列表，搜索，管理后台
   * English keywords:
   *   user list, search, admin panel
   */
  public async listUsers(query?: string): Promise<AdminUserListDTO[]> {
    const where = query
      ? {
          OR: [
            { username: { contains: query, mode: 'insensitive' as const } },
            { email: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const users = await prisma.user.findMany({
      where,
      take: 1000,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        role: { select: { name: true } },
        status: true,
        level: true,
        createdAt: true,
      },
    });
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      status: u.status,
      level: u.level,
      createdAt: u.createdAt,
      role: u.role?.name || null,
    }));
  }

  /**
   * 函数名称：listCategories
   *
   * 函数作用：
   *   获取按 sortOrder 排序的全部分类列表。
   * Purpose:
   *   Lists all categories ordered by sortOrder.
   *
   * 调用方 / Called by:
   *   adminController.getCategories → GET /api/admin/categories
   *
   * 返回值说明 / Returns:
   *   AdminCategoryListDTO[] 分类列表
   *
   * 副作用 / Side effects:
   *   无——只读查询
   *
   * 中文关键词：
   *   分类列表，排序，管理后台
   * English keywords:
   *   category list, sort, admin panel
   */
  public async listCategories(): Promise<AdminCategoryListDTO[]> {
    return prisma.category.findMany({ take: 1000, orderBy: { sortOrder: 'asc' } });
  }

  /**
   * 函数名称：listPosts
   *
   * 函数作用：
   *   获取当前用户管理后台可见的帖子列表，基于 CASL ability 过滤。
   * Purpose:
   *   Lists all posts accessible to the current user in the admin panel, filtered by CASL ability.
   *
   * 调用方 / Called by:
   *   adminController.getPosts → GET /api/admin/posts
   *
   * 参数说明 / Parameters:
   *   - ability: AppAbility, CASL 权限能力对象
   *
   * 返回值说明 / Returns:
   *   AdminPostListDTO[] 帖子列表
   *
   * 副作用 / Side effects:
   *   无——只读查询
   *
   * 中文关键词：
   *   帖子列表，权限过滤，管理后台
   * English keywords:
   *   post list, ability filter, admin panel
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

  /**
   * 函数名称：listDeletedPosts
   *
   * 函数作用：
   *   获取回收站中已删除的帖子列表。
   * Purpose:
   *   Lists soft-deleted posts in the recycle bin.
   *
   * 调用方 / Called by:
   *   adminController.getDeletedPosts → GET /api/admin/recycle/posts
   *
   * 参数说明 / Parameters:
   *   - ability: AppAbility, CASL 权限能力对象
   *
   * 返回值说明 / Returns:
   *   AdminDeletedPostListDTO[] 已删除帖子列表
   *
   * 副作用 / Side effects:
   *   无——只读查询
   *
   * 中文关键词：
   *   回收站，已删除帖子，列表
   * English keywords:
   *   recycle bin, deleted posts, list
   */
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
   * 函数名称：getPostById
   *
   * 函数作用：
   *   按 ID 获取帖子的详细信息，用于管理操作。
   * Purpose:
   *   Fetches a post by ID with full details for admin operations.
   *
   * 调用方 / Called by:
   *   adminController.restorePost / hardDeletePost / updatePostStatus
   *
   * 参数说明 / Parameters:
   *   - id: string, 帖子 ID
   *
   * 返回值说明 / Returns:
   *   AdminPostDTO | null，帖子不存在时返回 null
   *
   * 副作用 / Side effects:
   *   无——只读查询
   *
   * 中文关键词：
   *   帖子详情，ID 查询，管理
   * English keywords:
   *   post detail, ID query, admin
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
   * 函数名称：listDeletedComments
   *
   * 函数作用：
   *   获取回收站中已删除的评论列表。
   * Purpose:
   *   Lists soft-deleted comments in the recycle bin.
   *
   * 调用方 / Called by:
   *   adminController.getDeletedComments → GET /api/admin/recycle/comments
   *
   * 参数说明 / Parameters:
   *   - ability: AppAbility, CASL 权限能力对象
   *
   * 返回值说明 / Returns:
   *   AdminDeletedCommentListDTO[] 已删除评论列表
   *
   * 副作用 / Side effects:
   *   无——只读查询
   *
   * 中文关键词：
   *   回收站，已删除评论
   * English keywords:
   *   recycle bin, deleted comments
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
   * 函数名称：getModeratorScope
   *
   * 函数作用：
   *   获取用户的审核管辖范围（管辖分类 ID 列表或超级管理员标记）。
   * Purpose:
   *   Gets the moderation scope for a user (moderated category IDs or super admin flag).
   *
   * 调用方 / Called by:
   *   - listModeratedWords
   *   - listPendingPosts
   *   - listPendingComments
   *
   * 参数说明 / Parameters:
   *   - userId: string, 用户 ID
   *
   * 返回值说明 / Returns:
   *   AdminModeratorScopeDTO { isSuperAdmin: boolean, categoryIds?: string[] }
   *
   * 副作用 / Side effects:
   *   无——只读查询
   *
   * 中文关键词：
   *   审核范围，管辖分类，版主
   * English keywords:
   *   moderation scope, category IDs, moderator
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
   * 函数名称：listModeratedWords
   *
   * 函数作用：
   *   获取当前版主/管理员可见的敏感词列表。
   * Purpose:
   *   Lists moderated words visible to the current moderator or admin.
   *
   * 调用方 / Called by:
   *   moderationController.getModeratedWords → GET /api/admin/moderation/words
   *
   * 参数说明 / Parameters:
   *   - userId: string, 当前用户 ID（用于确定管辖范围）
   *
   * 返回值说明 / Returns:
   *   AdminModeratedWordListDTO[] 敏感词列表
   *
   * 副作用 / Side effects:
   *   无——只读查询
   *
   * 中文关键词：
   *   敏感词，列表，审核
   * English keywords:
   *   moderated words, list, moderation
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

  /**
   * 函数名称：getModeratedWordById
   *
   * 函数作用：
   *   按 ID 获取敏感词详情。
   * Purpose:
   *   Fetches a moderated word by ID.
   *
   * 调用方 / Called by:
   *   内部使用
   *
   * 参数说明 / Parameters:
   *   - id: string, 敏感词 ID
   *
   * 返回值说明 / Returns:
   *   AdminModeratedWordDTO | null
   *
   * 中文关键词：
   *   敏感词，ID 查询
   * English keywords:
   *   moderated word, ID query
   */
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

  /**
   * 函数名称：getRoleByName
   *
   * 函数作用：
   *   按角色名获取角色信息。
   * Purpose:
   *   Fetches a role by its name.
   *
   * 调用方 / Called by:
   *   安装流程、初始化流程
   *
   * 参数说明 / Parameters:
   *   - name: string, 角色名称（如 'USER'、'ADMIN'、'SUPER_ADMIN'）
   *
   * 返回值说明 / Returns:
   *   AdminRoleDTO | null
   *
   * 副作用 / Side effects:
   *   无——只读查询
   *
   * 中文关键词：
   *   角色，名称查询
   * English keywords:
   *   role, name query
   */
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

  /**
   * 函数名称：getRootUser
   *
   * 函数作用：
   *   获取 root 超级管理员用户（未封禁的）。
   * Purpose:
   *   Fetches the root super admin user (not banned).
   *
   * 调用方 / Called by:
   *   安装流程
   *
   * 返回值说明 / Returns:
   *   AdminUserDTO | null
   *
   * 副作用 / Side effects:
   *   无——只读查询
   *
   * 中文关键词：
   *   Root 用户，超级管理员
   * English keywords:
   *   root user, super admin
   */
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
/**
 * 控制器模块：Admin
 *
 * 函数作用：
 *   管理后台的 HTTP 请求处理，包括用户管理、分类管理、内容管理、回收站、
 *   数据库/域名/邮件配置、路由白名单和审核管理。
 * Purpose:
 *   HTTP request handling for the admin panel, including user management,
 *   category management, content management, recycle bin, database/domain/email
 *   configuration, route whitelist, and moderation management.
 *
 * 中文关键词：
 *   管理后台，用户，分类，内容，配置，审核
 * English keywords:
 *   admin panel, user, category, content, config, moderation
 */
import { Request, Response } from 'express';
import { adminQueryService } from '../queries/admin/AdminQueryService';
import { systemQueryService } from '../queries/system/SystemQueryService';
import { identityQueryService } from '../queries/identity/IdentityQueryService';
import { UserStatus, PostStatus } from '@myndbbs/shared';
import { AuthRequest } from '../middleware/auth';

import { auditApplicationService, adminUserManagementApplicationService, authApplicationService, userApplicationService, installationApplicationService, systemApplicationService, communityApplicationService, roleApplicationService, moderationApplicationService, emailConfigurationApplicationService } from '../registry';

// ── 用户管理 ──
/**
 * 函数名称：getUsers
 *
 * 函数作用：
 *   获取所有用户的列表，支持按关键字搜索。
 * Purpose:
 *   Retrieves a list of all users, with optional keyword search.
 *
 * 调用方 / Called by:
 *   GET /api/admin/users
 *
 * 被调用方 / Calls:
 *   - adminQueryService.listUsers
 *
 * 参数说明 / Parameters:
 *   - req.query.q: string | undefined, 搜索关键字
 *
 * 返回值说明 / Returns:
 *   200: AdminUserDTO[] 用户列表
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   管理，用户列表，搜索
 * English keywords:
 *   admin, user list, search
 */
export const getUsers = async (req: Request, res: Response) => {
  const q = (req.query.q || req.query.query) as string | undefined;
  const users = await adminQueryService.listUsers(q);
  res.json(users);
};

/**
 * 函数名称：updateUserRole
 *
 * 函数作用：
 *   更新指定用户的角色和等级。需要操作者有足够的权限层级。
 * Purpose:
 *   Updates a user's role and level. Requires the operator to have sufficient authority level.
 *
 * 调用方 / Called by:
 *   PATCH /api/admin/users/:id/role
 *
 * 被调用方 / Calls:
 *   - adminUserManagementApplicationService.changeUserRoleAndLevel
 *   - identityQueryService.getUserWithRoleById
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 目标用户 ID
 *   - req.body.role: string | undefined, 新角色名称
 *   - req.body.level: number | undefined, 新等级
 *
 * 返回值说明 / Returns:
 *   200: { message, user }
 *   400/403/404: { error: errorCode }
 *   500: { error: ERR_INTERNAL_SERVER_ERROR }
 *
 * 错误处理 / Error handling:
 *   - 404: 用户不存在
 *   - 403: 权限不足
 *   - 400: 其他业务错误
 *
 * 副作用 / Side effects:
 *   写数据库——更新用户角色和等级；发布事件；刷新权限缓存
 *
 * 事务边界 / Transaction:
 *   由 AdminUserManagementApplicationService 内部通过 UnitOfWork 管理
 *
 * 中文关键词：
 *   管理，用户角色，用户等级，权限变更
 * English keywords:
 *   admin, user role, user level, permission change
 */
export const updateUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { role, level } = req.body;
  const operatorId = req.user?.userId || 'unknown';

  try {
    await adminUserManagementApplicationService.changeUserRoleAndLevel(
      { userId: operatorId, role: (req.user?.role || 'USER') as any },
      id,
      { role: role as any, level }
    );

    const finalUser = await identityQueryService.getUserWithRoleById(id);
    res.json({ message: 'User updated', user: { id: finalUser?.id, role: finalUser?.role?.name, level: (finalUser as any)?.level } });
  } catch (error: any) {
    if (error.message.startsWith('ERR_')) {
      const status = error.message.includes('NOT_FOUND') ? 404 : error.message.includes('FORBIDDEN') ? 403 : 400;
      res.status(status).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
    }
  }
};

/**
 * 函数名称：updateUserStatus
 *
 * 函数作用：
 *   更新指定用户的状态（如封禁或激活）。
 * Purpose:
 *   Updates a user's status (e.g., banning or activating).
 *
 * 调用方 / Called by:
 *   PATCH /api/admin/users/:id/status
 *
 * 被调用方 / Calls:
 *   - adminUserManagementApplicationService.changeUserStatus
 *   - identityQueryService.getUserWithRoleById
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 目标用户 ID
 *   - req.body.status: UserStatus, 新状态（ACTIVE/BANNED 等）
 *
 * 返回值说明 / Returns:
 *   200: { message, user }
 *   400/403/404: { error: errorCode }
 *   500: { error: ERR_INTERNAL_SERVER_ERROR }
 *
 * 错误处理 / Error handling:
 *   - 404: 用户不存在
 *   - 403: 权限不足
 *   - 400: 其他业务错误
 *
 * 副作用 / Side effects:
 *   写数据库——更新用户状态；发布事件；刷新权限缓存
 *
 * 事务边界 / Transaction:
 *   由 AdminUserManagementApplicationService 内部通过 UnitOfWork 管理
 *
 * 中文关键词：
 *   管理，用户状态，封禁，激活
 * English keywords:
 *   admin, user status, ban, activate
 */
export const updateUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { status } = req.body;
  const operatorId = req.user?.userId || 'unknown';

  try {
    await adminUserManagementApplicationService.changeUserStatus(
      { userId: operatorId, role: (req.user?.role || 'USER') as any },
      id,
      status as UserStatus
    );

    const user = await identityQueryService.getUserWithRoleById(id);

    res.json({ message: 'Status updated', user: { id: user?.id, status: user?.status } });
  } catch (error: any) {
    if (error.message.startsWith('ERR_')) {
      const statusCode = error.message.includes('NOT_FOUND') ? 404 : error.message.includes('FORBIDDEN') ? 403 : 400;
      res.status(statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
    }
  }
};

// ── 分类管理 ──
/**
 * 函数名称：getCategories
 *
 * 函数作用：
 *   获取全部分类列表，用于管理后台展示。
 * Purpose:
 *   Retrieves all categories for the admin dashboard.
 *
 * 调用方 / Called by:
 *   GET /api/admin/categories
 *
 * 被调用方 / Calls:
 *   - adminQueryService.listCategories
 *
 * 参数说明 / Parameters:
 *   无
 *
 * 返回值说明 / Returns:
 *   200: AdminCategoryDTO[] 分类列表
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   管理，分类列表
 * English keywords:
 *   admin, category list
 */
export const getCategories = async (req: Request, res: Response) => {
  const categories = await adminQueryService.listCategories();
  res.json(categories);
};

/**
 * 函数名称：createCategory
 *
 * 函数作用：
 *   创建新的帖子分类。
 * Purpose:
 *   Creates a new post category.
 *
 * 调用方 / Called by:
 *   POST /api/admin/categories
 *
 * 被调用方 / Calls:
 *   - communityApplicationService.createCategory
 *
 * 参数说明 / Parameters:
 *   - req.body.name: string, 分类名称（必填）
 *   - req.body.description: string | undefined, 分类描述
 *   - req.body.sortOrder: number | undefined, 排序顺序
 *   - req.body.minLevel: number | undefined, 最小发帖等级
 *
 * 返回值说明 / Returns:
 *   200: Category 创建的分类对象
 *   400/500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 400: ERR_ 前缀业务错误
 *   - 500: ERR_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   写数据库——创建分类记录；发布 CategoryCreatedEvent
 *
 * 中文关键词：
 *   管理，创建分类
 * English keywords:
 *   admin, create category
 */
export const createCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, sortOrder, minLevel } = req.body;
    const operatorId = req.user?.userId || 'unknown';

    const category = await communityApplicationService.createCategory(
      name,
      description || null,
      sortOrder || 0,
      minLevel || 0,
      operatorId
    );

    res.json(category);
  } catch (error: any) {
    if (error.message.startsWith('ERR_')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_SERVER_ERROR' });
    }
  }
};

/**
 * 函数名称：updateCategory
 *
 * 函数作用：
 *   更新已有分类的详细信息。
 * Purpose:
 *   Updates an existing category's details.
 *
 * 调用方 / Called by:
 *   PUT /api/admin/categories/:id
 *
 * 被调用方 / Calls:
 *   - communityApplicationService.updateCategory
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 分类 ID
 *   - req.body.name: string, 新分类名称
 *   - req.body.description: string | undefined, 新描述
 *   - req.body.sortOrder: number, 新排序顺序
 *   - req.body.minLevel: number, 新最小发帖等级
 *
 * 返回值说明 / Returns:
 *   200: { message }
 *   404/400/500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 404: ERR_CATEGORY_NOT_FOUND
 *   - 400: 其他业务错误
 *   - 500: ERR_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   写数据库——更新分类；发布 CategoryUpdatedEvent
 *
 * 中文关键词：
 *   管理，更新分类
 * English keywords:
 *   admin, update category
 */
export const updateCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, description, sortOrder, minLevel } = req.body;
    const operatorId = req.user?.userId || 'unknown';

    await communityApplicationService.updateCategory(
      id,
      name,
      description !== undefined ? description : null,
      sortOrder,
      minLevel,
      operatorId
    );

    res.json({ message: 'Category updated successfully' });
  } catch (error: any) {
    if (error.message === 'ERR_CATEGORY_NOT_FOUND') {
      res.status(404).json({ error: 'ERR_CATEGORY_NOT_FOUND' });
    } else if (error.message.startsWith('ERR_')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_SERVER_ERROR' });
    }
  }
};

/**
 * 函数名称：deleteCategory
 *
 * 函数作用：
 *   删除分类及其关联的帖子。
 * Purpose:
 *   Deletes a category and its associated posts.
 *
 * 调用方 / Called by:
 *   DELETE /api/admin/categories/:id
 *
 * 被调用方 / Calls:
 *   - communityApplicationService.deleteCategory
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 分类 ID
 *
 * 返回值说明 / Returns:
 *   200: { message }
 *   404/500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 404: ERR_CATEGORY_NOT_FOUND
 *   - 500: ERR_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   写数据库——删除分类及关联帖子；发布 CategoryDeletedEvent
 *
 * 事务边界 / Transaction:
 *   由 communityApplicationService.deleteCategory 内部通过 UnitOfWork 管理
 *
 * 中文关键词：
 *   管理，删除分类，级联删除
 * English keywords:
 *   admin, delete category, cascade delete
 */
export const deleteCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const operatorId = req.user?.userId || 'unknown';

    await communityApplicationService.deleteCategory(id, operatorId);

    res.json({ message: 'Category deleted' });
  } catch (error: any) {
    if (error.message === 'ERR_CATEGORY_NOT_FOUND') {
      res.status(404).json({ error: 'ERR_CATEGORY_NOT_FOUND' });
    } else {
      res.status(500).json({ error: 'ERR_SERVER_ERROR' });
    }
  }
};

/**
 * 函数名称：assignCategoryModerator
 *
 * 函数作用：
 *   为指定分类分配版主。
 * Purpose:
 *   Assigns a moderator to a specific category.
 *
 * 调用方 / Called by:
 *   POST /api/admin/categories/:categoryId/moderators/:userId
 *
 * 被调用方 / Calls:
 *   - communityApplicationService.assignCategoryModerator
 *
 * 参数说明 / Parameters:
 *   - req.params.categoryId: string, 分类 ID
 *   - req.params.userId: string, 目标用户 ID
 *
 * 返回值说明 / Returns:
 *   200: { message, assignment }
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   500: ERR_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   写数据库——分配分类版主；发布 CategoryModeratorAssignedEvent
 *
 * 中文关键词：
 *   管理，版主，分类，分配
 * English keywords:
 *   admin, moderator, category, assign
 */
export const assignCategoryModerator = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categoryId = req.params.categoryId as string;
    const userId = req.params.userId as string;
    const operatorId = req.user?.userId || 'unknown';
    
    const assignment = await communityApplicationService.assignCategoryModerator(categoryId, userId, operatorId);

    res.json({ message: 'Moderator assigned', assignment });
  } catch (error) {
    res.status(500).json({ error: 'ERR_SERVER_ERROR' });
  }
};

/**
 * 函数名称：removeCategoryModerator
 *
 * 函数作用：
 *   移除指定分类的版主。
 * Purpose:
 *   Removes a moderator from a specific category.
 *
 * 调用方 / Called by:
 *   DELETE /api/admin/categories/:categoryId/moderators/:userId
 *
 * 被调用方 / Calls:
 *   - communityApplicationService.removeCategoryModerator
 *
 * 参数说明 / Parameters:
 *   - req.params.categoryId: string, 分类 ID
 *   - req.params.userId: string, 目标用户 ID
 *
 * 返回值说明 / Returns:
 *   200: { message }
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   500: ERR_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   写数据库——移除分类版主；发布 CategoryModeratorRemovedEvent
 *
 * 中文关键词：
 *   管理，版主，分类，移除
 * English keywords:
 *   admin, moderator, category, remove
 */
export const removeCategoryModerator = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categoryId = req.params.categoryId as string;
    const userId = req.params.userId as string;
    const operatorId = req.user?.userId || 'unknown';
    
    await communityApplicationService.removeCategoryModerator(categoryId, userId, operatorId);

    res.json({ message: 'Moderator removed' });
  } catch (error) {
    res.status(500).json({ error: 'ERR_SERVER_ERROR' });
  }
};

// ── 帖子管理 ──
/**
 * 函数名称：getPosts
 *
 * 函数作用：
 *   获取帖子列表，支持基于 CASL ability 的权限过滤。
 * Purpose:
 *   Retrieves a list of posts with CASL ability-based filtering.
 *
 * 调用方 / Called by:
 *   GET /api/admin/posts
 *
 * 被调用方 / Calls:
 *   - adminQueryService.listPosts
 *
 * 参数说明 / Parameters:
 *   无请求体参数（权限信息从 req.ability 获取）
 *
 * 返回值说明 / Returns:
 *   200: AdminPostDTO[] 帖子列表
 *   401: { error: ERR_UNAUTHORIZED }
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   管理，帖子列表，权限过滤
 * English keywords:
 *   admin, post list, ability filter
 */
export const getPosts = async (req: AuthRequest, res: Response) => {
  if (!req.ability) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }

  const posts = await adminQueryService.listPosts(req.ability);
  res.json(posts);
};

/**
 * 函数名称：updatePostStatus
 *
 * 函数作用：
 *   更新帖子状态（如发布、隐藏、置顶）。
 * Purpose:
 *   Updates a post's status (e.g., publish, hide, pin).
 *
 * 调用方 / Called by:
 *   PATCH /api/admin/posts/:id/status
 *
 * 被调用方 / Calls:
 *   - moderationApplicationService.changePostStatus
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 帖子 ID
 *   - req.body.status: PostStatus, 目标状态（PUBLISHED / HIDDEN / PINNED）
 *
 * 返回值说明 / Returns:
 *   200: { message, post }
 *   400/403/404: { error: errorCode }
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 400: ERR_INVALID_STATUS（状态值不合法）
 *   - 404: ERR_POST_NOT_FOUND
 *   - 403: ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_MANAGE_THIS_POST
 *   - 500: ERR_INTERNAL_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   写数据库——更新帖子状态
 *
 * 中文关键词：
 *   管理，帖子状态，发布，隐藏，置顶
 * English keywords:
 *   admin, post status, publish, hide, pin
 */
export const updatePostStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { status } = req.body;
  const operatorId = req.user?.userId || 'unknown';

  if (!([PostStatus.PUBLISHED, PostStatus.HIDDEN, PostStatus.PINNED] as PostStatus[]).includes(status as PostStatus)) {
    res.status(400).json({ error: 'ERR_INVALID_STATUS' });
    return;
  }

  try {
    const post = await moderationApplicationService.changePostStatus(id, status, operatorId, req.ability);
    res.json({ message: 'Post status updated', post });
  } catch (error: any) {
    if (error.message === 'ERR_POST_NOT_FOUND') {
      res.status(404).json({ error: 'ERR_POST_NOT_FOUND' });
    } else if (error.message === 'ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_MANAGE_THIS_POST') {
      res.status(403).json({ error: 'ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_MANAGE_THIS_POST' });
    } else {
      res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
    }
  }
};

// ── 回收站 ──
/**
 * 函数名称：getDeletedPosts
 *
 * 函数作用：
 *   获取已删除（软删除）的帖子列表。
 * Purpose:
 *   Retrieves the list of soft-deleted posts.
 *
 * 调用方 / Called by:
 *   GET /api/admin/recycle/posts
 *
 * 被调用方 / Calls:
 *   - adminQueryService.listDeletedPosts
 *
 * 参数说明 / Parameters:
 *   无请求体参数（权限信息从 req.ability 获取）
 *
 * 返回值说明 / Returns:
 *   200: AdminPostDTO[] 已删除帖子列表
 *   401: { error: ERR_UNAUTHORIZED }
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   管理，回收站，已删除帖子
 * English keywords:
 *   admin, recycle bin, deleted posts
 */
export const getDeletedPosts = async (req: AuthRequest, res: Response) => {
  if (!req.ability) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }
  const deletedPosts = await adminQueryService.listDeletedPosts(req.ability);
  res.json(deletedPosts);
};

/**
 * 函数名称：getDeletedComments
 *
 * 函数作用：
 *   获取已删除（软删除）的评论列表。
 * Purpose:
 *   Retrieves the list of soft-deleted comments.
 *
 * 调用方 / Called by:
 *   GET /api/admin/recycle/comments
 *
 * 被调用方 / Calls:
 *   - adminQueryService.listDeletedComments
 *
 * 参数说明 / Parameters:
 *   无请求体参数（权限信息从 req.ability 获取）
 *
 * 返回值说明 / Returns:
 *   200: AdminCommentDTO[] 已删除评论列表
 *   401: { error: ERR_UNAUTHORIZED }
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   管理，回收站，已删除评论
 * English keywords:
 *   admin, recycle bin, deleted comments
 */
export const getDeletedComments = async (req: AuthRequest, res: Response) => {
  if (!req.ability) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }
  const deletedComments = await adminQueryService.listDeletedComments(req.ability);
  res.json(deletedComments);
};




/**
 * 函数名称：restorePost
 *
 * 函数作用：
 *   恢复已软删除的帖子。
 * Purpose:
 *   Restores a soft-deleted post.
 *
 * 调用方 / Called by:
 *   POST /api/admin/recycle/posts/:id/restore
 *
 * 被调用方 / Calls:
 *   - moderationApplicationService.restorePost
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 帖子 ID
 *
 * 返回值说明 / Returns:
 *   200: { message }
 *   403/404: { error: errorCode }
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 404: ERR_POST_NOT_FOUND
 *   - 403: ERR_FORBIDDEN
 *   - 500: ERR_INTERNAL_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   写数据库——还原帖子状态
 *
 * 中文关键词：
 *   管理，回收站，恢复帖子
 * English keywords:
 *   admin, recycle bin, restore post
 */
export const restorePost = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const operatorId = req.user?.userId || 'unknown';

  try {
    await moderationApplicationService.restorePost(id, operatorId, req.ability);
    res.json({ message: 'Post restored' });
  } catch (error: any) {
    if (error.message === 'ERR_POST_NOT_FOUND') {
      res.status(404).json({ error: 'ERR_POST_NOT_FOUND' });
    } else if (error.message === 'ERR_FORBIDDEN') {
      res.status(403).json({ error: 'ERR_FORBIDDEN' });
    } else {
      res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
    }
  }
};

/**
 * 函数名称：hardDeletePost
 *
 * 函数作用：
 *   从数据库中永久删除帖子。
 * Purpose:
 *   Permanently deletes a post from the database.
 *
 * 调用方 / Called by:
 *   DELETE /api/admin/recycle/posts/:id
 *
 * 被调用方 / Calls:
 *   - moderationApplicationService.hardDeletePost
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 帖子 ID
 *
 * 返回值说明 / Returns:
 *   200: { message }
 *   403/404: { error: errorCode }
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 404: ERR_POST_NOT_FOUND
 *   - 403: ERR_FORBIDDEN
 *   - 500: ERR_INTERNAL_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   写数据库——永久删除帖子记录（不可恢复）
 *
 * 中文关键词：
 *   管理，回收站，永久删除帖子
 * English keywords:
 *   admin, recycle bin, hard delete post
 */
export const hardDeletePost = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const operatorId = req.user?.userId || 'unknown';

  try {
    await moderationApplicationService.hardDeletePost(id, operatorId, req.ability);
    res.json({ message: 'Post permanently deleted' });
  } catch (error: any) {
    if (error.message === 'ERR_POST_NOT_FOUND') {
      res.status(404).json({ error: 'ERR_POST_NOT_FOUND' });
    } else if (error.message === 'ERR_FORBIDDEN') {
      res.status(403).json({ error: 'ERR_FORBIDDEN' });
    } else {
      res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
    }
  }
};

/**
 * 函数名称：restoreComment
 *
 * 函数作用：
 *   恢复已软删除的评论。
 * Purpose:
 *   Restores a soft-deleted comment.
 *
 * 调用方 / Called by:
 *   POST /api/admin/recycle/comments/:id/restore
 *
 * 被调用方 / Calls:
 *   - moderationApplicationService.restoreComment
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 评论 ID
 *
 * 返回值说明 / Returns:
 *   200: { message }
 *   403/404: { error: errorCode }
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 404: ERR_COMMENT_NOT_FOUND
 *   - 403: ERR_FORBIDDEN
 *   - 500: ERR_INTERNAL_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   写数据库——还原评论状态
 *
 * 中文关键词：
 *   管理，回收站，恢复评论
 * English keywords:
 *   admin, recycle bin, restore comment
 */
export const restoreComment = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const operatorId = req.user?.userId || 'unknown';

  try {
    await moderationApplicationService.restoreComment(id, operatorId, req.ability);
    res.json({ message: 'Comment restored' });
  } catch (error: any) {
    if (error.message === 'ERR_COMMENT_NOT_FOUND') {
      res.status(404).json({ error: 'ERR_COMMENT_NOT_FOUND' });
    } else if (error.message === 'ERR_FORBIDDEN') {
      res.status(403).json({ error: 'ERR_FORBIDDEN' });
    } else {
      res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
    }
  }
};

/**
 * 函数名称：hardDeleteComment
 *
 * 函数作用：
 *   从数据库中永久删除评论。
 * Purpose:
 *   Permanently deletes a comment from the database.
 *
 * 调用方 / Called by:
 *   DELETE /api/admin/recycle/comments/:id
 *
 * 被调用方 / Calls:
 *   - moderationApplicationService.hardDeleteComment
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 评论 ID
 *
 * 返回值说明 / Returns:
 *   200: { message }
 *   403/404: { error: errorCode }
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 404: ERR_COMMENT_NOT_FOUND
 *   - 403: ERR_FORBIDDEN
 *   - 500: ERR_INTERNAL_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   写数据库——永久删除评论记录（不可恢复）
 *
 * 中文关键词：
 *   管理，回收站，永久删除评论
 * English keywords:
 *   admin, recycle bin, hard delete comment
 */
export const hardDeleteComment = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const operatorId = req.user?.userId || 'unknown';

  try {
    await moderationApplicationService.hardDeleteComment(id, operatorId, req.ability);
    res.json({ message: 'Comment permanently deleted' });
  } catch (error: any) {
    if (error.message === 'ERR_COMMENT_NOT_FOUND') {
      res.status(404).json({ error: 'ERR_COMMENT_NOT_FOUND' });
    } else if (error.message === 'ERR_FORBIDDEN') {
      res.status(403).json({ error: 'ERR_FORBIDDEN' });
    } else {
      res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
    }
  }
};

// ── 数据库配置 ──

/**
 * 函数名称：getDbConfig
 *
 * 函数作用：
 *   获取当前数据库配置。
 * Purpose:
 *   Retrieves the current database configuration.
 *
 * 调用方 / Called by:
 *   GET /api/admin/db-config
 *
 * 被调用方 / Calls:
 *   - installationApplicationService.getCurrentDbConfig
 *
 * 参数说明 / Parameters:
 *   无请求体参数（角色从 req.user.role 获取）
 *
 * 返回值说明 / Returns:
 *   200: DbConfigDTO 数据库配置对象
 *   403/500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 403: ERR_FORBIDDEN_SUPER_ADMIN_ONLY
 *   - 500: ERR_INTERNAL_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   管理，数据库配置，读取
 * English keywords:
 *   admin, database config, read
 */
export const getDbConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cfg = installationApplicationService.getCurrentDbConfig(req.user?.role);
    res.json(cfg);
  } catch (error: any) {
    if (error.message === 'ERR_FORBIDDEN_SUPER_ADMIN_ONLY') {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
    }
  }
};

/**
 * 函数名称：updateDbConfig
 *
 * 函数作用：
 *   更新数据库连接配置。
 * Purpose:
 *   Updates the database connection configuration.
 *
 * 调用方 / Called by:
 *   POST /api/admin/db-config
 *
 * 被调用方 / Calls:
 *   - installationApplicationService.updateDbConfig
 *
 * 参数说明 / Parameters:
 *   - req.body.host: string, 数据库主机地址
 *   - req.body.port: number, 数据库端口
 *   - req.body.username: string, 数据库用户名
 *   - req.body.password: string, 数据库密码
 *   - req.body.database: string, 数据库名
 *   - 敏感注意：password 仅用于本次请求，不持久保存到日志
 *
 * 返回值说明 / Returns:
 *   200: { message, config }
 *   403/500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 403: ERR_FORBIDDEN_SUPER_ADMIN_ONLY
 *   - 500: ERR_DB_CONNECTION_FAILED
 *
 * 副作用 / Side effects:
 *   写环境变量——更新 .env 中的 DATABASE_URL
 *
 * 中文关键词：
 *   管理，数据库配置，更新
 * English keywords:
 *   admin, database config, update
 */
export const updateDbConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  const { host, port, username, password, database } = req.body;
  const operatorId = req.user?.userId || 'unknown';

  try {
    await installationApplicationService.updateDbConfig(host, port, username, password, database, req.user?.role, operatorId);
    res.json({ message: 'Database configuration updated successfully', config: { host, port, username, database } });
  } catch (err: any) {
    if (err.message === 'ERR_FORBIDDEN_SUPER_ADMIN_ONLY') {
      res.status(403).json({ error: err.message });
      return;
    }
    console.error('Prisma Error on DB Update:', err.message);
    res.status(500).json({ error: 'ERR_DB_CONNECTION_FAILED' });
  }
};

/**
 * 函数名称：getDomainConfig
 *
 * 函数作用：
 *   获取当前域名配置。
 * Purpose:
 *   Retrieves the current domain configuration.
 *
 * 调用方 / Called by:
 *   GET /api/admin/domain-config
 *
 * 被调用方 / Calls:
 *   - installationApplicationService.getDomainConfig
 *
 * 参数说明 / Parameters:
 *   无请求体参数（角色从 req.user.role 获取）
 *
 * 返回值说明 / Returns:
 *   200: DomainConfigDTO 域名配置对象
 *   403/500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 403: ERR_FORBIDDEN_SUPER_ADMIN_ONLY
 *   - 500: ERR_INTERNAL_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   管理，域名配置，读取
 * English keywords:
 *   admin, domain config, read
 */
export const getDomainConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const config = installationApplicationService.getDomainConfig(req.user?.role);
    res.json(config);
  } catch (error: any) {
    if (error.message === 'ERR_FORBIDDEN_SUPER_ADMIN_ONLY') {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
    }
  }
};

/**
 * 函数名称：updateDomainConfig
 *
 * 函数作用：
 *   更新域名配置并计划重启服务器。
 * Purpose:
 *   Updates the domain configuration and schedules a server restart.
 *
 * 调用方 / Called by:
 *   POST /api/admin/domain-config
 *
 * 被调用方 / Calls:
 *   - installationApplicationService.updateDomainConfig
 *   - installationApplicationService.scheduleRestart
 *
 * 参数说明 / Parameters:
 *   - req.body.protocol: string, 协议（http / https）
 *   - req.body.hostname: string, 主机名
 *   - req.body.rpId: string, WebAuthn 信赖方 ID
 *   - req.body.reverseProxyMode: boolean, 是否启用反向代理模式
 *
 * 返回值说明 / Returns:
 *   200: { message }
 *   400/403/500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 403: ERR_FORBIDDEN_SUPER_ADMIN_ONLY
 *   - 400: ERR_INVALID_DOMAIN_CONFIG
 *   - 500: ERR_INTERNAL_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   - 写环境变量——更新 .env 中的域名相关配置
 *   - 触发服务器重启（1 秒延迟）
 *
 * 中文关键词：
 *   管理，域名配置，更新，服务重启
 * English keywords:
 *   admin, domain config, update, server restart
 */
export const updateDomainConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  const { protocol, hostname, rpId, reverseProxyMode } = req.body;

  try {
    await installationApplicationService.updateDomainConfig({
      protocol,
      hostname,
      rpId,
      reverseProxyMode,
    }, req.user?.role);
  } catch (err: any) {
    if (err.message === 'ERR_FORBIDDEN_SUPER_ADMIN_ONLY') {
      res.status(403).json({ error: err.message });
    } else if (err.message === 'ERR_INVALID_DOMAIN_CONFIG') {
      res.status(400).json({ error: 'ERR_INVALID_DOMAIN_CONFIG' });
    } else {
      res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
    }
    return;
  }

  res.json({ message: 'Domain configuration updated. Restarting...' });
  installationApplicationService.scheduleRestart(1000);
};


// ── 路由白名单管理 ──
/**
 * 函数名称：getRouteWhitelist
 *
 * 函数作用：
 *   获取路由白名单列表。
 * Purpose:
 *   Retrieves the route whitelist for access control.
 *
 * 调用方 / Called by:
 *   GET /api/admin/routing-whitelist
 *   GET /api/public/routing-whitelist
 *
 * 被调用方 / Calls:
 *   - systemQueryService.listRouteWhitelist
 *
 * 参数说明 / Parameters:
 *   无
 *
 * 返回值说明 / Returns:
 *   200: RouteWhitelistDTO[] 白名单路由列表
 *   500: { error: errorCode }
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   管理，路由白名单，列表
 * English keywords:
 *   admin, route whitelist, list
 */
export const getRouteWhitelist = async (req: Request, res: Response) => {
  try {
    const routes = await systemQueryService.listRouteWhitelist();
    res.json(routes);
  } catch (error) {
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_ROUTE_WHITELIST' });
  }
};

/**
 * 函数名称：addRouteWhitelist
 *
 * 函数作用：
 *   向路由白名单添加新路由。
 * Purpose:
 *   Adds a new route to the whitelist.
 *
 * 调用方 / Called by:
 *   POST /api/admin/routing-whitelist
 *
 * 被调用方 / Calls:
 *   - systemApplicationService.addRouteWhitelist
 *
 * 参数说明 / Parameters:
 *   - req.body.path: string, 路由路径（必填）
 *   - req.body.isPrefix: boolean, 是否前缀匹配
 *   - req.body.minRole: string | undefined, 最低角色
 *   - req.body.description: string | undefined, 描述说明
 *
 * 返回值说明 / Returns:
 *   200: RouteWhitelist 新创建的白名单路由对象
 *   400/500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 400: ERR_ROUTE_WHITELIST_PATH_REQUIRED
 *   - 500: ERR_FAILED_TO_ADD_ROUTE_WHITELIST
 *
 * 副作用 / Side effects:
 *   写数据库——创建白名单路由记录
 *
 * 中文关键词：
 *   管理，路由白名单，添加
 * English keywords:
 *   admin, route whitelist, add
 */
export const addRouteWhitelist = async (req: Request, res: Response) => {
  try {
    const { path, isPrefix, minRole, description } = req.body;
    if (!path) return res.status(400).json({ error: 'ERR_ROUTE_WHITELIST_PATH_REQUIRED' });

    const route = await systemApplicationService.addRouteWhitelist(path, !!isPrefix, minRole || null, description);
    res.json(route);
  } catch (error) {
    res.status(500).json({ error: 'ERR_FAILED_TO_ADD_ROUTE_WHITELIST' });
  }
};

/**
 * 函数名称：updateRouteWhitelist
 *
 * 函数作用：
 *   更新路由白名单中已有的路由。
 * Purpose:
 *   Updates an existing route in the whitelist.
 *
 * 调用方 / Called by:
 *   PUT /api/admin/routing-whitelist/:id
 *
 * 被调用方 / Calls:
 *   - systemApplicationService.updateRouteWhitelist
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 白名单记录 ID
 *   - req.body.path: string, 路由路径
 *   - req.body.isPrefix: boolean, 是否前缀匹配
 *   - req.body.minRole: string | undefined, 最低角色
 *   - req.body.description: string | undefined, 描述说明
 *
 * 返回值说明 / Returns:
 *   200: RouteWhitelist 更新后的白名单路由对象
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   500: ERR_FAILED_TO_UPDATE_ROUTE_WHITELIST
 *
 * 副作用 / Side effects:
 *   写数据库——更新白名单路由记录
 *
 * 中文关键词：
 *   管理，路由白名单，更新
 * English keywords:
 *   admin, route whitelist, update
 */
export const updateRouteWhitelist = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { path, isPrefix, minRole, description } = req.body;

    const route = await systemApplicationService.updateRouteWhitelist(id, path, !!isPrefix, minRole || null, description);
    res.json(route);
  } catch (error) {
    res.status(500).json({ error: 'ERR_FAILED_TO_UPDATE_ROUTE_WHITELIST' });
  }
};

/**
 * 函数名称：deleteRouteWhitelist
 *
 * 函数作用：
 *   从路由白名单中删除指定路由。
 * Purpose:
 *   Deletes a route from the whitelist.
 *
 * 调用方 / Called by:
 *   DELETE /api/admin/routing-whitelist/:id
 *
 * 被调用方 / Calls:
 *   - systemApplicationService.deleteRouteWhitelist
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 白名单记录 ID
 *
 * 返回值说明 / Returns:
 *   200: { success: true }
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   500: ERR_FAILED_TO_DELETE_ROUTE_WHITELIST
 *
 * 副作用 / Side effects:
 *   写数据库——删除白名单路由记录
 *
 * 中文关键词：
 *   管理，路由白名单，删除
 * English keywords:
 *   admin, route whitelist, delete
 */
export const deleteRouteWhitelist = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await systemApplicationService.deleteRouteWhitelist(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'ERR_FAILED_TO_DELETE_ROUTE_WHITELIST' });
  }
};

// ── Email Configuration ──

/**
 * 函数名称：getEmailConfig
 *
 * 函数作用：
 *   获取当前 SMTP 配置和邮件模板列表。
 * Purpose:
 *   Retrieves the current SMTP configuration and email template list.
 *
 * 调用方 / Called by:
 *   GET /api/admin/email-config
 *
 * 被调用方 / Calls:
 *   - emailConfigurationApplicationService.getSmtpConfig
 *   - emailConfigurationApplicationService.getEmailTemplates
 *
 * 参数说明 / Parameters:
 *   无请求体参数（角色从 req.user.role 获取）
 *
 * 返回值说明 / Returns:
 *   200: { smtpConfig, templates }
 *   403/500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 403: ERR_FORBIDDEN_SUPER_ADMIN_ONLY
 *   - 500: ERR_INTERNAL_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   管理，邮件配置，SMTP，模板
 * English keywords:
 *   admin, email config, SMTP, templates
 */
export const getEmailConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const smtpConfig = emailConfigurationApplicationService.getSmtpConfig(req.user?.role);
    const templates = await emailConfigurationApplicationService.getEmailTemplates(req.user?.role);
    res.json({ smtpConfig, templates });
  } catch (error: any) {
    if (error.message === 'ERR_FORBIDDEN_SUPER_ADMIN_ONLY') {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
    }
  }
};

/**
 * 函数名称：updateEmailConfig
 *
 * 函数作用：
 *   更新 SMTP 邮件发送配置，保存后自动重启服务器。
 * Purpose:
 *   Updates SMTP email configuration and restarts the server on save.
 *
 * 调用方 / Called by:
 *   POST /api/admin/email-config
 *
 * 被调用方 / Calls:
 *   - emailConfigurationApplicationService.updateSmtpConfig
 *   - installationApplicationService.scheduleRestart
 *
 * 参数说明 / Parameters:
 *   - req.body.host: string, SMTP 主机地址
 *   - req.body.port: number, SMTP 端口
 *   - req.body.secure: boolean, 是否使用 TLS
 *   - req.body.user: string, SMTP 用户名
 *   - req.body.pass: string, SMTP 密码
 *   - req.body.from: string, 发件人地址
 *   - 敏感注意：pass 仅用于本次请求配置，不存储到日志
 *
 * 返回值说明 / Returns:
 *   200: { message }
 *   403/500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 403: ERR_FORBIDDEN_SUPER_ADMIN_ONLY
 *   - 500: ERR_INTERNAL_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   - 写环境变量——更新 SMTP 配置
 *   - 触发服务器重启（1 秒延迟）
 *
 * 中文关键词：
 *   管理，邮件配置，SMTP，更新，重启
 * English keywords:
 *   admin, email config, SMTP, update, restart
 */
export const updateEmailConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { host, port, secure, user, pass, from } = req.body;
    await emailConfigurationApplicationService.updateSmtpConfig({ host, port, secure: !!secure, user, pass, from }, req.user?.role);
    res.json({ message: 'Email configuration saved. The server is restarting to apply changes.' });
    installationApplicationService.scheduleRestart(1000);
  } catch (error: any) {
    if (error.message === 'ERR_FORBIDDEN_SUPER_ADMIN_ONLY') {
      res.status(403).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * 函数名称：updateEmailTemplate
 *
 * 函数作用：
 *   按类型更新邮件模板（主题、文本正文、HTML 正文）。
 * Purpose:
 *   Updates an email template by type (subject, text body, HTML body).
 *
 * 调用方 / Called by:
 *   PUT /api/admin/email-config/templates/:type
 *
 * 被调用方 / Calls:
 *   - emailConfigurationApplicationService.updateEmailTemplate
 *
 * 参数说明 / Parameters:
 *   - req.body.type: string, 模板类型标识
 *   - req.body.subject: string, 邮件主题
 *   - req.body.textBody: string, 文本正文
 *   - req.body.htmlBody: string, HTML 正文
 *
 * 返回值说明 / Returns:
 *   200: { message }
 *   403/500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 403: ERR_FORBIDDEN_SUPER_ADMIN_ONLY
 *   - 500: ERR_INTERNAL_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   写数据库——更新邮件模板
 *
 * 中文关键词：
 *   管理，邮件模板，更新
 * English keywords:
 *   admin, email template, update
 */
export const updateEmailTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, subject, textBody, htmlBody } = req.body;
    await emailConfigurationApplicationService.updateEmailTemplate(type, subject, textBody, htmlBody, req.user?.role);
    res.json({ message: 'Email template updated successfully' });
  } catch (error: any) {
    if (error.message === 'ERR_FORBIDDEN_SUPER_ADMIN_ONLY') {
      res.status(403).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * 函数名称：sendTestEmail
 *
 * 函数作用：
 *   向指定地址发送测试邮件，可使用当前 SMTP 配置或临时提供的配置。
 * Purpose:
 *   Sends a test email to the specified address using current or provided SMTP config.
 *
 * 调用方 / Called by:
 *   POST /api/admin/email-config/test
 *
 * 被调用方 / Calls:
 *   - emailConfigurationApplicationService.sendTestEmail
 *
 * 参数说明 / Parameters:
 *   - req.body.targetEmail: string, 测试邮件的目标邮箱地址
 *   - req.body.smtpConfig: object | undefined, 临时 SMTP 配置（可选，不传则使用系统配置）
 *
 * 返回值说明 / Returns:
 *   200: { message }
 *   400/403/500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 403: ERR_FORBIDDEN_SUPER_ADMIN_ONLY
 *   - 400: ERR_EMAIL_DELIVERY_FAILED / ERR_EMAIL_DELIVERY_NOT_CONFIGURED
 *   - 500: ERR_EMAIL_DELIVERY_FAILED
 *
 * 副作用 / Side effects:
 *   发送外发 SMTP 邮件
 *
 * 中文关键词：
 *   管理，测试邮件，SMTP 发送
 * English keywords:
 *   admin, test email, SMTP send
 */
export const sendTestEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { targetEmail, smtpConfig } = req.body;
    await emailConfigurationApplicationService.sendTestEmail(targetEmail, smtpConfig, req.user?.role);
    res.json({ message: 'Test email sent successfully' });
  } catch (error: any) {
    if (error.message === 'ERR_FORBIDDEN_SUPER_ADMIN_ONLY') {
      res.status(403).json({ error: error.message });
      return;
    }
    if (error.message === 'ERR_EMAIL_DELIVERY_FAILED' || error.message === 'ERR_EMAIL_DELIVERY_NOT_CONFIGURED') {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'ERR_EMAIL_DELIVERY_FAILED' });
  }
};

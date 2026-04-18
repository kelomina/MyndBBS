import { Request, Response } from 'express';
import { adminQueryService } from '../queries/admin/AdminQueryService';
import { systemQueryService } from '../queries/system/SystemQueryService';
import { identityQueryService } from '../queries/identity/IdentityQueryService';
import { UserStatus, PostStatus } from '@myndbbs/shared';
import { AuthRequest } from '../middleware/auth';

import { auditApplicationService, adminUserManagementApplicationService, authApplicationService, userApplicationService, installationApplicationService, systemApplicationService, communityApplicationService, roleApplicationService, moderationApplicationService } from '../registry';

// Users
/**
 * Callers: [Router]
 * Callees: [adminQueryService]
 * Description: Retrieves a list of all users for the admin dashboard.
 * Keywords: admin, users, list
 *
 * @param {Request} req - Express Request object, optionally containing a query parameter `q` for search.
 * @param {Response} res - Express Response object.
 */
export const getUsers = async (req: Request, res: Response) => {
  const q = (req.query.q || req.query.query) as string | undefined;
  const users = await adminQueryService.listUsers(q);
  res.json(users);
};

/**
 * Callers: [Router]
 * Callees: [adminUserManagementApplicationService, identityQueryService]
 * Description: Updates a user's role and level.
 * Keywords: admin, user, role, level
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
 * Callers: [Router]
 * Callees: [adminUserManagementApplicationService, identityQueryService]
 * Description: Updates a user's status (e.g., banning or activating).
 * Keywords: admin, user, status
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

// Categories
/**
 * Callers: [Router]
 * Callees: [adminQueryService]
 * Description: Retrieves a list of all categories for the admin dashboard.
 * Keywords: admin, categories, list
 */
export const getCategories = async (req: Request, res: Response) => {
  const categories = await adminQueryService.listCategories();
  res.json(categories);
};

/**
 * Callers: [Router]
 * Callees: [communityApplicationService]
 * Description: Creates a new category.
 * Keywords: admin, category, create
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
 * Callers: [Router]
 * Callees: [communityApplicationService]
 * Description: Updates an existing category.
 * Keywords: admin, category, update
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
 * Callers: [Router]
 * Callees: [communityApplicationService]
 * Description: Deletes a category.
 * Keywords: admin, category, delete
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
 * Callers: [Router]
 * Callees: [communityApplicationService]
 * Description: Assigns a user as a moderator for a specific category.
 * Keywords: admin, category, moderator, assign
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
 * Callers: [Router]
 * Callees: [communityApplicationService]
 * Description: Removes a user from the moderator role for a specific category.
 * Keywords: admin, category, moderator, remove
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

// Posts
/**
 * Callers: [Router]
 * Callees: [adminQueryService]
 * Description: Retrieves a list of posts for the admin dashboard.
 * Keywords: admin, posts, list
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
 * Callers: [Router]
 * Callees: [moderationApplicationService]
 * Description: Updates the status of a post (e.g., publish, hide, pin).
 * Keywords: admin, post, status
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

// Recycle Bin
/**
 * Callers: [Router]
 * Callees: [adminQueryService]
 * Description: Retrieves a list of deleted posts (recycle bin).
 * Keywords: admin, recycle bin, posts, deleted
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
 * Callers: [Router]
 * Callees: [adminQueryService]
 * Description: Retrieves a list of deleted comments (recycle bin).
 * Keywords: admin, recycle bin, comments, deleted
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
 * Callers: [Router]
 * Callees: [moderationApplicationService]
 * Description: Restores a soft-deleted post.
 * Keywords: admin, recycle bin, post, restore
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
 * Callers: [Router]
 * Callees: [moderationApplicationService]
 * Description: Permanently deletes a post.
 * Keywords: admin, recycle bin, post, hard delete
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
 * Callers: [Router]
 * Callees: [moderationApplicationService]
 * Description: Restores a soft-deleted comment.
 * Keywords: admin, recycle bin, comment, restore
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
 * Callers: [Router]
 * Callees: [moderationApplicationService]
 * Description: Permanently deletes a comment.
 * Keywords: admin, recycle bin, comment, hard delete
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

// Database Config

/**
 * Callers: [Router]
 * Callees: [installationApplicationService]
 * Description: Retrieves the current database configuration.
 * Keywords: admin, config, database
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
 * Callers: [Router]
 * Callees: [installationApplicationService]
 * Description: Updates the database configuration.
 * Keywords: admin, config, database, update
 */
export const updateDbConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  const { host, port, username, password, database } = req.body;
  const operatorId = req.user?.userId || 'unknown';

  try {
    await installationApplicationService.updateDbConfig(host, port, username, password, database, req.user?.role, operatorId);
    res.json({ message: 'Database configuration updated successfully', config: { host, port, username, password, database } });
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
 * Callers: [Router]
 * Callees: [installationApplicationService]
 * Description: Retrieves the current domain configuration.
 * Keywords: admin, config, domain
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
 * Callers: [Router]
 * Callees: [installationApplicationService]
 * Description: Updates the domain configuration and schedules a restart.
 * Keywords: admin, config, domain, update
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


// Route Whitelist Management
/**
 * Callers: [Router]
 * Callees: [systemQueryService]
 * Description: Retrieves the route whitelist for system access control.
 * Keywords: admin, routes, whitelist
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
 * Callers: [Router]
 * Callees: [systemApplicationService]
 * Description: Adds a new route to the whitelist.
 * Keywords: admin, routes, whitelist, add
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
 * Callers: [Router]
 * Callees: [systemApplicationService]
 * Description: Updates an existing route in the whitelist.
 * Keywords: admin, routes, whitelist, update
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
 * Callers: [Router]
 * Callees: [systemApplicationService]
 * Description: Deletes a route from the whitelist.
 * Keywords: admin, routes, whitelist, delete
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

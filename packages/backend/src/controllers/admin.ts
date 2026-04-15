import { Request, Response } from 'express';
import { adminQueryService } from '../queries/admin/AdminQueryService';
import { systemQueryService } from '../queries/system/SystemQueryService';
import { identityQueryService } from '../queries/identity/IdentityQueryService';
import { UserStatus } from '../domain/identity/User';
import { PostStatus } from '@prisma/client';
import { redis } from '../lib/redis';
import { logAudit } from '../lib/audit';
import { AuthRequest } from '../middleware/auth';
import { UserApplicationService } from '../application/identity/UserApplicationService';
import { RoleApplicationService } from '../application/identity/RoleApplicationService';
import { PrismaPermissionRepository } from '../infrastructure/repositories/PrismaPermissionRepository';
import { PrismaUserRepository } from '../infrastructure/repositories/PrismaUserRepository';
import { PrismaRoleRepository } from '../infrastructure/repositories/PrismaRoleRepository';

import { SystemApplicationService } from '../application/system/SystemApplicationService';
import { AuthApplicationService } from '../application/identity/AuthApplicationService';
import { PrismaCaptchaChallengeRepository } from '../infrastructure/repositories/PrismaCaptchaChallengeRepository';
import { PrismaPasskeyRepository } from '../infrastructure/repositories/PrismaPasskeyRepository';
import { PrismaSessionRepository } from '../infrastructure/repositories/PrismaSessionRepository';
import { PrismaAuthChallengeRepository } from '../infrastructure/repositories/PrismaAuthChallengeRepository';
import { PrismaRouteWhitelistRepository } from '../infrastructure/repositories/PrismaRouteWhitelistRepository';

const systemApplicationService = new SystemApplicationService(
  new PrismaRouteWhitelistRepository(),
  new PrismaUserRepository(),
  new PrismaRoleRepository()
);
const roleApplicationService = new RoleApplicationService(
  new PrismaRoleRepository(),
  new PrismaPermissionRepository(),
  new PrismaUserRepository()
);

const authApplicationService = new AuthApplicationService(
  new PrismaCaptchaChallengeRepository(),
  new PrismaPasskeyRepository(),
  new PrismaSessionRepository(),
  new PrismaAuthChallengeRepository(),
  new PrismaUserRepository(),
  new PrismaRoleRepository()
);
import { CommunityApplicationService } from '../application/community/CommunityApplicationService';
import { PrismaCategoryRepository } from '../infrastructure/repositories/PrismaCategoryRepository';
import { PrismaEngagementRepository } from '../infrastructure/repositories/PrismaEngagementRepository';
import { ModerationApplicationService } from '../application/community/ModerationApplicationService';
import { PrismaPostRepository } from '../infrastructure/repositories/PrismaPostRepository';
import { PrismaCommentRepository } from '../infrastructure/repositories/PrismaCommentRepository';
import { PrismaModeratedWordRepository } from '../infrastructure/repositories/PrismaModeratedWordRepository';
import { globalEventBus } from '../infrastructure/events/InMemoryEventBus';

const userApplicationService = new UserApplicationService(new PrismaUserRepository());
const communityApplicationService = new CommunityApplicationService(
  new PrismaCategoryRepository(),
  new PrismaPostRepository(),
  new PrismaCommentRepository(),
  new PrismaEngagementRepository(),
  new PrismaUserRepository(),
  new PrismaRoleRepository()
);
const moderationApplicationService = new ModerationApplicationService(
  new PrismaPostRepository(),
  new PrismaCommentRepository(),
  new PrismaModeratedWordRepository(),
  globalEventBus
);

// Users
/**
 * Callers: []
 * Callees: [findMany, map, json]
 * Description: Handles the get users logic for the application.
 * Keywords: getusers, get, users, auto-annotated
 */
export const getUsers = async (req: Request, res: Response) => {
  const users = await adminQueryService.listUsers();
  res.json(users);
};

/**
 * Callers: []
 * Callees: [findUnique, json, status, findMany, update, logAudit, includes, pipeline, del, exec, deleteMany, set, findFirst]
 * Description: Handles the update user role logic for the application.
 * Keywords: updateuserrole, update, user, role, auto-annotated
 */
export const updateUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { role, level } = req.body;
  const operatorId = req.user?.userId || 'unknown';

  const currentUser = await identityQueryService.getUserWithRoleById(id);

  if (!currentUser) {
    res.status(404).json({ error: 'ERR_USER_NOT_FOUND' });
    return;
  }

  let finalUser = currentUser;

  if (level !== undefined) {
    if (level < 1 || level > 6) {
      res.status(400).json({ error: 'ERR_LEVEL_MUST_BE_BETWEEN_1_AND_6' });
      return;
    }

    if (level > 1) {
      const passkeys = await identityQueryService.listPasskeys(id);
      if (passkeys.length === 0) {
        res.status(400).json({ error: 'ERR_CANNOT_PROMOTE_WITHOUT_PASSKEY' });
        return;
      }
    }
    await userApplicationService.changeLevel(id, level);
    finalUser = await identityQueryService.getUserWithRoleById(id) as any;
    await logAudit(operatorId, 'UPDATE_USER_LEVEL', `User:${id} to Level:${level}`);
  }

  if (role) {
    if (!['USER', 'ADMIN', 'MODERATOR', 'SUPER_ADMIN'].includes(role)) {
      res.status(400).json({ error: 'ERR_INVALID_ROLE' });
      return;
    }
    
    const roleRecord = await adminQueryService.getRoleByName(role);
    if (!roleRecord) {
      res.status(400).json({ error: 'ERR_ROLE_NOT_FOUND_IN_DATABASE' });
      return;
    }

    const roleLevels: Record<string, number> = {
      'SUPER_ADMIN': 4,
      'ADMIN': 3,
      'MODERATOR': 2,
      'USER': 1
    };

    const currentRoleLevel = roleLevels[currentUser.role?.name || 'USER'] || 1;
    const newRoleLevel = roleLevels[role] || 1;

    // Prevent managing users with equal or higher roles than the operator
    const operatorRoleLevel = roleLevels[req.user?.role || 'USER'] || 1;
    if (currentRoleLevel >= operatorRoleLevel && req.user?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'ERR_FORBIDDEN_CANNOT_MANAGE_USER_WITH_EQUAL_OR_HIGHER_ROLE' });
      return;
    }

    if (newRoleLevel > operatorRoleLevel && req.user?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'ERR_FORBIDDEN_CANNOT_GRANT_A_ROLE_HIGHER_THAN_YOUR_OWN' });
      return;
    }

    await userApplicationService.changeRole(id, roleRecord.id);
    finalUser = await identityQueryService.getUserWithRoleById(id) as any;

    if (newRoleLevel < currentRoleLevel) {
      // Revoke sessions on downgrade
      const sessions = await identityQueryService.listSessions(id);
      if (sessions.length > 0) {
        const pipeline = redis.pipeline();
        for (const session of sessions) {
          pipeline.del(`session:${session.id}`);
        }
        await pipeline.exec();
        await authApplicationService.revokeAllUserSessions(id);
      }
    } else if (newRoleLevel > currentRoleLevel) {
      // Mark sessions for refresh on promotion
      const sessions = await identityQueryService.listSessions(id);
      if (sessions.length > 0) {
        const pipeline = redis.pipeline();
        for (const session of sessions) {
          pipeline.set(`session:${session.id}:requires_refresh`, 'true', 'EX', 7 * 24 * 60 * 60); // same as session expiry
        }
        await pipeline.exec();
      }
    }

    // Auto-disable root if another user gets SUPER_ADMIN role
    if (role === 'SUPER_ADMIN' && finalUser.username !== 'root') {
      const rootUser = await adminQueryService.getRootUser();
      if (rootUser) {
        await userApplicationService.changeStatus(rootUser.id, UserStatus.BANNED);
        // Revoke root sessions
        const rootSessions = await identityQueryService.listSessions(rootUser.id);
        if (rootSessions.length > 0) {
          const pipeline = redis.pipeline();
          for (const session of rootSessions) {
            pipeline.del(`session:${session.id}`);
          }
          await pipeline.exec();
          await authApplicationService.revokeAllUserSessions(rootUser.id);
        }
        await logAudit('system', 'AUTO_DISABLE_ROOT', 'root');
      }
    }

    await logAudit(operatorId, 'UPDATE_USER_ROLE', `User:${id} to ${role}`);
  }

  res.json({ message: 'User updated', user: { id: finalUser.id, role: finalUser.role?.name, level: (finalUser as any).level } });
};

/**
 * Callers: []
 * Callees: [includes, json, status, findUnique, update, findMany, pipeline, del, exec, deleteMany, logAudit]
 * Description: Handles the update user status logic for the application.
 * Keywords: updateuserstatus, update, user, status, auto-annotated
 */
export const updateUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { status } = req.body;
  const operatorId = req.user?.userId || 'unknown';

  if (!([UserStatus.ACTIVE, UserStatus.BANNED, UserStatus.PENDING_VERIFICATION, UserStatus.INACTIVE] as UserStatus[]).includes(status as UserStatus)) {
    res.status(400).json({ error: 'ERR_INVALID_STATUS' });
    return;
  }

  const targetUser = await identityQueryService.getUserWithRoleById(id);
  if (!targetUser) {
    res.status(404).json({ error: 'ERR_USER_NOT_FOUND' });
    return;
  }

  const roleLevels: Record<string, number> = { 'SUPER_ADMIN': 4, 'ADMIN': 3, 'MODERATOR': 2, 'USER': 1 };
  const targetRoleLevel = roleLevels[targetUser.role?.name || 'USER'] || 1;
  const operatorRoleLevel = roleLevels[req.user?.role || 'USER'] || 1;

  if (targetRoleLevel >= operatorRoleLevel && req.user?.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'ERR_FORBIDDEN_CANNOT_MANAGE_USER_WITH_EQUAL_OR_HIGHER_ROLE' });
    return;
  }

  await userApplicationService.changeStatus(id, status);
  const user = await identityQueryService.getUserWithRoleById(id) as any;

  if (status === UserStatus.BANNED) {
    // Revoke sessions on ban
    const sessions = await identityQueryService.listSessions(id);
    if (sessions.length > 0) {
      const pipeline = redis.pipeline();
      for (const session of sessions) {
        pipeline.del(`session:${session.id}`);
      }
      await pipeline.exec();
      await authApplicationService.revokeAllUserSessions(id);
    }
  }

  await logAudit(operatorId, 'UPDATE_USER_STATUS', `User:${id} to ${status}`);

  res.json({ message: 'Status updated', user: { id: user.id, status: user.status } });
};

// Categories
/**
 * Callers: []
 * Callees: [findMany, json]
 * Description: Handles the get categories logic for the application.
 * Keywords: getcategories, get, categories, auto-annotated
 */
export const getCategories = async (req: Request, res: Response) => {
  const categories = await adminQueryService.listCategories();
  res.json(categories);
};

/**
 * Callers: []
 * Callees: [CommunityApplicationService.createCategory, logAudit, json, status]
 * Description: Orchestrates the creation of a new category via the domain service.
 * Keywords: create, category, community, service
 */
export const createCategory = async (req: AuthRequest, res: Response) => {
  const { name, description, sortOrder, minLevel } = req.body;
  const operatorId = req.user?.userId || 'unknown';

  try {
    const category = await communityApplicationService.createCategory(name, description, sortOrder, minLevel);
    await logAudit(operatorId, 'CREATE_CATEGORY', `Category:${category.id}`);
    res.status(201).json(category);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Callers: []
 * Callees: [CommunityApplicationService.updateCategory, logAudit, json]
 * Description: Orchestrates the update of a category via the domain service.
 * Keywords: update, category, community, service
 */
export const updateCategory = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { name, description, sortOrder, minLevel } = req.body;
  const operatorId = req.user?.userId || 'unknown';

  try {
    await communityApplicationService.updateCategory(id, name, description, sortOrder, minLevel);
    await logAudit(operatorId, 'UPDATE_CATEGORY', `Category:${id}`);
    res.json({ message: 'Category updated successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Callers: []
 * Callees: [CommunityApplicationService.deleteCategory, logAudit, json, status]
 * Description: Orchestrates the deletion of a category via the domain service.
 * Keywords: delete, category, community, service
 */
export const deleteCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const operatorId = req.user?.userId || 'unknown';

    await communityApplicationService.deleteCategory(id);
    await logAudit(operatorId, 'DELETE_CATEGORY', `Category:${id}`);

    res.json({ message: 'Category deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'ERR_FAILED_TO_DELETE_CATEGORY' });
  }
};

/**
 * Callers: []
 * Callees: [findUnique, json, status, upsert, logAudit]
 * Description: Handles the assign category moderator logic for the application.
 * Keywords: assigncategorymoderator, assign, category, moderator, auto-annotated
 */
export const assignCategoryModerator = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categoryId = req.params.categoryId as string;
    const userId = req.params.userId as string;
    const operatorId = req.user?.userId || 'unknown';
    
    const assignment = await communityApplicationService.assignCategoryModerator(categoryId, userId);

    await logAudit(operatorId, 'ASSIGN_CATEGORY_MODERATOR', `User:${userId} to Category:${categoryId}`);

    res.json({ message: 'Moderator assigned', assignment });
  } catch (error) {
    res.status(500).json({ error: 'ERR_SERVER_ERROR' });
  }
};

/**
 * Callers: []
 * Callees: [delete, logAudit, json, status]
 * Description: Handles the remove category moderator logic for the application.
 * Keywords: removecategorymoderator, remove, category, moderator, auto-annotated
 */
export const removeCategoryModerator = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categoryId = req.params.categoryId as string;
    const userId = req.params.userId as string;
    const operatorId = req.user?.userId || 'unknown';
    
    await communityApplicationService.removeCategoryModerator(categoryId, userId);

    await logAudit(operatorId, 'REMOVE_CATEGORY_MODERATOR', `User:${userId} from Category:${categoryId}`);

    res.json({ message: 'Moderator removed' });
  } catch (error) {
    res.status(500).json({ error: 'ERR_SERVER_ERROR' });
  }
};

// Posts
/**
 * Callers: []
 * Callees: [json, status, findMany, accessibleBy]
 * Description: Handles the get posts logic for the application.
 * Keywords: getposts, get, posts, auto-annotated
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
 * Callers: []
 * Callees: [includes, json, status, findUnique, can, subject, update, logAudit]
 * Description: Handles the update post status logic for the application.
 * Keywords: updatepoststatus, update, post, status, auto-annotated
 */
export const updatePostStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { status } = req.body;
  const operatorId = req.user?.userId || 'unknown';

  if (!([PostStatus.PUBLISHED, PostStatus.HIDDEN, PostStatus.PINNED] as PostStatus[]).includes(status as PostStatus)) {
    res.status(400).json({ error: 'ERR_INVALID_STATUS' });
    return;
  }

  const existingPost = await adminQueryService.getPostById(id);
  if (!existingPost) {
    res.status(404).json({ error: 'ERR_POST_NOT_FOUND' });
    return;
  }

  const { subject } = await import('@casl/ability');
  if (!req.ability?.can('update_status', subject('Post', existingPost as any))) {
    res.status(403).json({ error: 'ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_MANAGE_THIS_POST' });
    return;
  }

  const post = await moderationApplicationService.changePostStatus(id, status);

  await logAudit(operatorId, 'UPDATE_POST_STATUS', `Post:${id} to ${status}`);

  res.json({ message: 'Post status updated', post });
};

// Recycle Bin
/**
 * Callers: []
 * Callees: [json, status, findMany, accessibleBy]
 * Description: Handles the get deleted posts logic for the application.
 * Keywords: getdeletedposts, get, deleted, posts, auto-annotated
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
 * Callers: []
 * Callees: [json, status, findMany, accessibleBy]
 * Description: Handles the get deleted comments logic for the application.
 * Keywords: getdeletedcomments, get, deleted, comments, auto-annotated
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
 * Callers: []
 * Callees: [handleAdminAction, findUnique, update]
 * Description: Handles the restore post logic for the application.
 * Keywords: restorepost, restore, post, auto-annotated
 */
export const restorePost = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const operatorId = req.user?.userId || 'unknown';

  const existingPost = await adminQueryService.getPostById(id);
  if (!existingPost) { res.status(404).json({ error: 'ERR_POST_NOT_FOUND' }); return; }

  const { subject } = await import('@casl/ability');
  if (!req.ability?.can('manage', subject('Post', existingPost as any))) {
    res.status(403).json({ error: 'ERR_FORBIDDEN' }); return;
  }

  await moderationApplicationService.restorePost(id);
  await logAudit(operatorId, 'RESTORE_POST', `Post:${id}`);
  res.json({ message: 'Post restored' });
};

/**
 * Callers: []
 * Callees: [handleAdminAction, findUnique, delete]
 * Description: Handles the hard delete post logic for the application.
 * Keywords: harddeletepost, hard, delete, post, auto-annotated
 */
export const hardDeletePost = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const operatorId = req.user?.userId || 'unknown';

  const existingPost = await adminQueryService.getPostById(id);
  if (!existingPost) { res.status(404).json({ error: 'ERR_POST_NOT_FOUND' }); return; }

  const { subject } = await import('@casl/ability');
  if (!req.ability?.can('manage', subject('Post', existingPost as any))) {
    res.status(403).json({ error: 'ERR_FORBIDDEN' }); return;
  }

  await moderationApplicationService.hardDeletePost(id);
  await logAudit(operatorId, 'HARD_DELETE_POST', `Post:${id}`);
  res.json({ message: 'Post permanently deleted' });
};

/**
 * Callers: []
 * Callees: [handleAdminAction, findUnique, update]
 * Description: Handles the restore comment logic for the application.
 * Keywords: restorecomment, restore, comment, auto-annotated
 */
export const restoreComment = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const operatorId = req.user?.userId || 'unknown';

  const existingComment = await adminQueryService.getCommentWithPost(id);
  if (!existingComment) { res.status(404).json({ error: 'ERR_COMMENT_NOT_FOUND' }); return; }

  const { subject } = await import('@casl/ability');
  if (!req.ability?.can('manage', subject('Comment', existingComment as any))) {
    res.status(403).json({ error: 'ERR_FORBIDDEN' }); return;
  }

  await moderationApplicationService.restoreComment(id);
  await logAudit(operatorId, 'RESTORE_COMMENT', `Comment:${id}`);
  res.json({ message: 'Comment restored' });
};

/**
 * Callers: []
 * Callees: [handleAdminAction, findUnique, delete]
 * Description: Handles the hard delete comment logic for the application.
 * Keywords: harddeletecomment, hard, delete, comment, auto-annotated
 */
export const hardDeleteComment = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const operatorId = req.user?.userId || 'unknown';

  const existingComment = await adminQueryService.getCommentWithPost(id);
  if (!existingComment) { res.status(404).json({ error: 'ERR_COMMENT_NOT_FOUND' }); return; }

  const { subject } = await import('@casl/ability');
  if (!req.ability?.can('manage', subject('Comment', existingComment as any))) {
    res.status(403).json({ error: 'ERR_FORBIDDEN' }); return;
  }

  await moderationApplicationService.hardDeleteComment(id);
  await logAudit(operatorId, 'HARD_DELETE_COMMENT', `Comment:${id}`);
  res.json({ message: 'Comment permanently deleted' });
};

// Database Config
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { applyDomainConfigToEnv, buildOrigin, EnvFileService, getBackendEnvPath } from '../lib/EnvFileService';

/**
 * Callers: []
 * Callees: [json, status, parseInt, decodeURIComponent, slice]
 * Description: Handles the get db config logic for the application.
 * Keywords: getdbconfig, get, db, config, auto-annotated
 */
export const getDbConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'ERR_FORBIDDEN_SUPER_ADMIN_ONLY' });
    return;
  }

  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      const url = new URL(dbUrl);
      res.json({
        host: url.hostname,
        port: url.port ? parseInt(url.port) : 5432,
        username: url.username,
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1)
      });
      return;
    } catch (e) {
      // Ignore parsing errors and fallback
    }
  }

  res.json({
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: '',
    database: 'myndbbs'
  });
};

/**
 * Callers: []
 * Callees: [json, status, encodeURIComponent, updateDatabaseConfiguration, logAudit, setTimeout, exit]
 * Description: Handles the update db config logic for the application.
 * Keywords: updatedbconfig, update, db, config, auto-annotated
 */
export const updateDbConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'ERR_FORBIDDEN_SUPER_ADMIN_ONLY' });
    return;
  }

  const { host, port, username, password, database } = req.body;
  const operatorId = req.user?.userId || 'unknown';

  const newDbUrl = `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${database}?schema=public`;

  try {
    try {
      await systemApplicationService.updateDatabaseConfiguration(newDbUrl);
    } catch (err: any) {
      console.error('Prisma Error on DB Update:', err.message);
      res.status(500).json({ error: '数据库初始化失败，请检查连接或权限。' });
      return;
    }

    await logAudit(operatorId, 'UPDATE_DB_CONFIG', 'PostgreSQL config updated in .env');
    res.json({ message: 'Database configuration updated successfully', config: { host, port, username, password, database } });

    /**
     * Callers: [updateDbConfig]
     * Callees: [exit]
     * Description: An anonymous timeout callback that forcefully restarts the server.
     * Keywords: admin, restart, exit, timeout, anonymous
     */
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  } catch (error) {
    console.error('DB Connection Test Failed:', error);
    res.status(500).json({ error: 'ERR_DB_CONNECTION_FAILED' });
  }
};

export const getDomainConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'ERR_FORBIDDEN_SUPER_ADMIN_ONLY' });
    return;
  }

  const originRaw = process.env.ORIGIN || 'http://localhost';
  const splitIndex = originRaw.indexOf('://');
  const protocol = splitIndex > -1 ? originRaw.slice(0, splitIndex) : 'http';
  const hostname = splitIndex > -1 ? originRaw.slice(splitIndex + 3) : originRaw;
  const rpId = process.env.RP_ID || hostname || 'localhost';
  const reverseProxyMode = process.env.TRUST_PROXY === 'true';

  res.json({
    protocol,
    hostname,
    rpId,
    reverseProxyMode,
    origin: buildOrigin(protocol, hostname),
  });
};

export const updateDomainConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'ERR_FORBIDDEN_SUPER_ADMIN_ONLY' });
    return;
  }

  const { protocol, hostname, rpId, reverseProxyMode } = req.body;
  const normalizedProtocol = protocol === 'https' ? 'https' : 'http';
  const normalizedHostname = String(hostname || '').trim();
  const normalizedRpId = String(rpId || '').trim();

  const envFile = new EnvFileService(getBackendEnvPath(__dirname));
  const before = await envFile.read();
  let after: string;

  try {
    after = applyDomainConfigToEnv(before, {
      protocol: normalizedProtocol,
      hostname: normalizedHostname,
      rpId: normalizedRpId,
      reverseProxyMode: !!reverseProxyMode,
    });
  } catch {
    res.status(400).json({ error: 'ERR_INVALID_DOMAIN_CONFIG' });
    return;
  }

  await envFile.write(after);

  const origin = buildOrigin(normalizedProtocol, normalizedHostname);
  process.env.ORIGIN = origin;
  process.env.RP_ID = normalizedRpId;
  process.env.TRUST_PROXY = !!reverseProxyMode ? 'true' : 'false';

  const m = after.match(/^FRONTEND_URL=(.*)$/m);
  if (m?.[1]) {
    process.env.FRONTEND_URL = m[1].trim().replace(/^"(.*)"$/, '$1');
  }

  res.json({ message: 'Domain configuration updated. Restarting...' });

  setTimeout(() => {
    process.exit(0);
  }, 1000);
};


// Route Whitelist Management
/**
 * Callers: []
 * Callees: [findMany, json, status]
 * Description: Handles the get route whitelist logic for the application.
 * Keywords: getroutewhitelist, get, route, whitelist, auto-annotated
 */
export const getRouteWhitelist = async (req: Request, res: Response) => {
  try {
    const routes = await systemQueryService.listRouteWhitelist();
    res.json(routes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch route whitelist' });
  }
};

/**
 * Callers: []
 * Callees: [json, status, create]
 * Description: Handles the add route whitelist logic for the application.
 * Keywords: addroutewhitelist, add, route, whitelist, auto-annotated
 */
export const addRouteWhitelist = async (req: Request, res: Response) => {
  try {
    const { path, isPrefix, minRole, description } = req.body;
    if (!path) return res.status(400).json({ error: 'Path is required' });

    const route = await systemApplicationService.addRouteWhitelist(path, !!isPrefix, minRole || null, description);
    res.json(route);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add route whitelist' });
  }
};

/**
 * Callers: []
 * Callees: [update, json, status]
 * Description: Handles the update route whitelist logic for the application.
 * Keywords: updateroutewhitelist, update, route, whitelist, auto-annotated
 */
export const updateRouteWhitelist = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { path, isPrefix, minRole, description } = req.body;

    const route = await systemApplicationService.updateRouteWhitelist(id, path, !!isPrefix, minRole || null, description);
    res.json(route);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update route whitelist' });
  }
};

/**
 * Callers: []
 * Callees: [delete, json, status]
 * Description: Handles the delete route whitelist logic for the application.
 * Keywords: deleteroutewhitelist, delete, route, whitelist, auto-annotated
 */
export const deleteRouteWhitelist = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await systemApplicationService.deleteRouteWhitelist(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete route whitelist' });
  }
};

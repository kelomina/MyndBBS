import { Request, Response } from 'express';
import { prisma } from '../db';
import { PrismaClient } from '@prisma/client';
import { UserStatus, PostStatus } from '@prisma/client';
import { redis } from '../lib/redis';
import { logAudit } from '../lib/audit';
import { AuthRequest } from '../middleware/auth';

// Users
/**
 * Callers: []
 * Callees: [findMany, map, json]
 * Description: Handles the get users logic for the application.
 * Keywords: getusers, get, users, auto-annotated
 */
export const getUsers = async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    take: 1000,
    select: { id: true, username: true, email: true, role: { select: { name: true } }, status: true, createdAt: true }
  });
  /**
   * Callers: [getUsers]
   * Callees: []
   * Description: An anonymous callback mapping user properties to a formatted object.
   * Keywords: admin, users, map, format, anonymous
   */
  const formattedUsers = users.map(user => ({
    ...user,
    role: user.role?.name || null
  }));
  res.json(formattedUsers);
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

  const currentUser = await prisma.user.findUnique({
    where: { id },
    include: { role: true }
  });

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
      const passkeys = await prisma.passkey.findMany({ where: { userId: id } });
      if (passkeys.length === 0) {
        res.status(400).json({ error: 'ERR_CANNOT_PROMOTE_WITHOUT_PASSKEY' });
        return;
      }
    }
    finalUser = await prisma.user.update({
      where: { id },
      data: { level },
      include: { role: true }
    });
    await logAudit(operatorId, 'UPDATE_USER_LEVEL', `User:${id} to Level:${level}`);
  }

  if (role) {
    if (!['USER', 'ADMIN', 'MODERATOR', 'SUPER_ADMIN'].includes(role)) {
      res.status(400).json({ error: 'ERR_INVALID_ROLE' });
      return;
    }
    
    const roleRecord = await prisma.role.findUnique({ where: { name: role } });
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

    finalUser = await prisma.user.update({ 
      where: { id }, 
      data: { roleId: roleRecord.id },
      include: { role: true }
    });

    if (newRoleLevel < currentRoleLevel) {
      // Revoke sessions on downgrade
      const sessions = await prisma.session.findMany({ where: { userId: id } });
      if (sessions.length > 0) {
        const pipeline = redis.pipeline();
        for (const session of sessions) {
          pipeline.del(`session:${session.id}`);
        }
        await pipeline.exec();
        await prisma.session.deleteMany({ where: { userId: id } });
      }
    } else if (newRoleLevel > currentRoleLevel) {
      // Mark sessions for refresh on promotion
      const sessions = await prisma.session.findMany({ where: { userId: id } });
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
      const rootUser = await prisma.user.findFirst({
        where: { username: 'root', status: { not: UserStatus.BANNED } }
      });
      if (rootUser) {
        await prisma.user.update({
          where: { id: rootUser.id },
          data: { status: UserStatus.BANNED }
        });
        // Revoke root sessions
        const rootSessions = await prisma.session.findMany({ where: { userId: rootUser.id } });
        if (rootSessions.length > 0) {
          const pipeline = redis.pipeline();
          for (const session of rootSessions) {
            pipeline.del(`session:${session.id}`);
          }
          await pipeline.exec();
          await prisma.session.deleteMany({ where: { userId: rootUser.id } });
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

  if (!([UserStatus.ACTIVE, UserStatus.BANNED, UserStatus.PENDING] as UserStatus[]).includes(status as UserStatus)) {
    res.status(400).json({ error: 'ERR_INVALID_STATUS' });
    return;
  }

  const targetUser = await prisma.user.findUnique({ where: { id }, include: { role: true } });
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

  const user = await prisma.user.update({ where: { id }, data: { status } });

  if (status === UserStatus.BANNED) {
    // Revoke sessions on ban
    const sessions = await prisma.session.findMany({ where: { userId: id } });
    if (sessions.length > 0) {
      const pipeline = redis.pipeline();
      for (const session of sessions) {
        pipeline.del(`session:${session.id}`);
      }
      await pipeline.exec();
      await prisma.session.deleteMany({ where: { userId: id } });
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
  const categories = await prisma.category.findMany({ take: 1000, orderBy: { sortOrder: 'asc' } });
  res.json(categories);
};

/**
 * Callers: []
 * Callees: [create, logAudit, json, status]
 * Description: Handles the create category logic for the application.
 * Keywords: createcategory, create, category, auto-annotated
 */
export const createCategory = async (req: AuthRequest, res: Response) => {
  const { name, description, sortOrder, minLevel } = req.body;
  const operatorId = req.user?.userId || 'unknown';

  const category = await prisma.category.create({
    data: { name, description, sortOrder: sortOrder || 0, minLevel: minLevel || 0 }
  });

  await logAudit(operatorId, 'CREATE_CATEGORY', `Category:${category.id}`);

  res.status(201).json(category);
};

/**
 * Callers: []
 * Callees: [update, logAudit, json]
 * Description: Handles the update category logic for the application.
 * Keywords: updatecategory, update, category, auto-annotated
 */
export const updateCategory = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { name, description, sortOrder, minLevel } = req.body;
  const operatorId = req.user?.userId || 'unknown';

  const category = await prisma.category.update({
    where: { id },
    data: { name, description, sortOrder, minLevel }
  });

  await logAudit(operatorId, 'UPDATE_CATEGORY', `Category:${category.id}`);

  res.json(category);
};

/**
 * Callers: []
 * Callees: [$transaction, deleteMany, delete, logAudit, json, status]
 * Description: Handles the delete category logic for the application.
 * Keywords: deletecategory, delete, category, auto-annotated
 */
export const deleteCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const operatorId = req.user?.userId || 'unknown';

    await prisma.$transaction([
      prisma.post.deleteMany({ where: { categoryId: id } }),
      prisma.category.delete({ where: { id } })
    ]);

    await logAudit(operatorId, 'DELETE_CATEGORY', `Category:${id}`);

    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ error: 'ERR_FAILED_TO_DELETE_CATEGORY' });
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
    
    // Ensure both user and category exist, and user is a MODERATOR
    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      include: { role: true }
    });
    if (!user || user.role?.name !== 'MODERATOR') {
      res.status(400).json({ error: 'ERR_USER_NOT_FOUND_OR_IS_NOT_A_MODERATOR' });
      return;
    }

    const assignment = await prisma.categoryModerator.upsert({
      where: {
        categoryId_userId: { categoryId, userId }
      },
      update: {},
      create: { categoryId, userId }
    });

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
    
    await prisma.categoryModerator.delete({
      where: {
        categoryId_userId: { categoryId, userId }
      }
    });

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
  const { accessibleBy } = await import('@casl/prisma');
  
  if (!req.ability) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }

  const posts = await prisma.post.findMany({
    take: 1000,
    where: accessibleBy(req.ability, 'read').Post,
    include: { author: { select: { username: true } }, category: { select: { name: true } } },
    orderBy: { createdAt: 'desc' }
  });
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

  const existingPost = await prisma.post.findUnique({ where: { id } });
  if (!existingPost) {
    res.status(404).json({ error: 'ERR_POST_NOT_FOUND' });
    return;
  }

  const { subject } = await import('@casl/ability');
  if (!req.ability?.can('update_status', subject('Post', existingPost as any))) {
    res.status(403).json({ error: 'ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_MANAGE_THIS_POST' });
    return;
  }

  const post = await prisma.post.update({ where: { id }, data: { status } });

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
  const { accessibleBy } = await import('@casl/prisma');
  if (!req.ability) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }
  const posts = await prisma.post.findMany({
    take: 1000,
    where: {
      AND: [
        accessibleBy(req.ability, 'manage').Post,
        { status: PostStatus.DELETED }
      ]
    },
    include: { author: { select: { username: true } }, category: { select: { name: true } } },
    orderBy: { updatedAt: 'desc' }
  });
  res.json(posts);
};

/**
 * Callers: []
 * Callees: [json, status, findMany, accessibleBy]
 * Description: Handles the get deleted comments logic for the application.
 * Keywords: getdeletedcomments, get, deleted, comments, auto-annotated
 */
export const getDeletedComments = async (req: AuthRequest, res: Response) => {
  const { accessibleBy } = await import('@casl/prisma');
  if (!req.ability) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }
  const comments = await prisma.comment.findMany({
    take: 1000,
    where: {
      AND: [
        accessibleBy(req.ability, 'manage').Comment,
        { deletedAt: { not: null } }
      ]
    },
    include: { author: { select: { username: true } }, post: { select: { id: true, title: true, category: { select: { name: true } } } } },
    orderBy: { deletedAt: 'desc' }
  });
  res.json(comments);
};


// Helper for admin actions on entities
/**
 * Callers: [restorePost, hardDeletePost, restoreComment, hardDeleteComment]
 * Callees: [json, status, error, logAudit, req]
 * Description: An abstract handler to process admin actions like restore or hard delete.
 * Keywords: admin, action, abstract, handle, restore, delete, auto-annotated
 */
const handleAdminAction = async (
  req: AuthRequest,
  res: Response,
  modelName: 'Post' | 'Comment',
  actionType: 'RESTORE' | 'HARD_DELETE',
  findUniqueFn: (id: string) => Promise<any>,
  operationFn: (id: string) => Promise<any>,
  successMessage: string
): Promise<void> => {
  const id = req.params.id as string;
  const operatorId = req.user?.userId || 'unknown';

  const entity = await findUniqueFn(id);
  if (!entity) {
    res.status(404).json({ error: `ERR_${modelName.toUpperCase()}_NOT_FOUND` });
    return;
  }

  const { subject } = await import('@casl/ability');
  if (!req.ability?.can('manage', subject(modelName, entity as any))) {
    res.status(403).json({ error: 'ERR_FORBIDDEN' });
    return;
  }

  await operationFn(id);
  await logAudit(operatorId, `${actionType}_${modelName.toUpperCase()}`, `${modelName}:${id}`);
  res.json({ message: successMessage });
};

/**
 * Callers: []
 * Callees: [handleAdminAction, findUnique, update]
 * Description: Handles the restore post logic for the application.
 * Keywords: restorepost, restore, post, auto-annotated
 */
export const restorePost = async (req: AuthRequest, res: Response): Promise<void> => {
  return handleAdminAction(
    req, res, 'Post', 'RESTORE',
    /**
     * Callers: [handleAdminAction]
     * Callees: [findUnique]
     * Description: An anonymous callback to find a post by id.
     * Keywords: admin, post, find, anonymous
     */
    (id) => prisma.post.findUnique({ where: { id } }),
    /**
     * Callers: [handleAdminAction]
     * Callees: [update]
     * Description: An anonymous callback to update a post's status to published.
     * Keywords: admin, post, restore, anonymous
     */
    (id) => prisma.post.update({ where: { id }, data: { status: PostStatus.PUBLISHED } }),
    'Post restored'
  );
};

/**
 * Callers: []
 * Callees: [handleAdminAction, findUnique, delete]
 * Description: Handles the hard delete post logic for the application.
 * Keywords: harddeletepost, hard, delete, post, auto-annotated
 */
export const hardDeletePost = async (req: AuthRequest, res: Response): Promise<void> => {
  return handleAdminAction(
    req,
    res,
    'Post',
    'HARD_DELETE',
    /**
     * Callers: [handleAdminAction]
     * Callees: [findUnique]
     * Description: An anonymous callback to find a post by id.
     * Keywords: admin, post, find, anonymous
     */
    (id) => prisma.post.findUnique({ where: { id } }),
    /**
     * Callers: [handleAdminAction]
     * Callees: [delete]
     * Description: An anonymous callback to hard delete a post.
     * Keywords: admin, post, delete, anonymous
     */
    (id) => prisma.post.delete({ where: { id } }),
    'Post permanently deleted'
  );
};

/**
 * Callers: []
 * Callees: [handleAdminAction, findUnique, update]
 * Description: Handles the restore comment logic for the application.
 * Keywords: restorecomment, restore, comment, auto-annotated
 */
export const restoreComment = async (req: AuthRequest, res: Response): Promise<void> => {
  return handleAdminAction(
    req,
    res,
    'Comment',
    'RESTORE',
    /**
     * Callers: [handleAdminAction]
     * Callees: [findUnique]
     * Description: An anonymous callback to find a comment by id.
     * Keywords: admin, comment, find, anonymous
     */
    (id) => prisma.comment.findUnique({ where: { id }, include: { post: true } }),
    /**
     * Callers: [handleAdminAction]
     * Callees: [update]
     * Description: An anonymous callback to restore a comment.
     * Keywords: admin, comment, restore, anonymous
     */
    (id) => prisma.comment.update({ where: { id }, data: { deletedAt: null } }),
    'Comment restored'
  );
};

/**
 * Callers: []
 * Callees: [handleAdminAction, findUnique, delete]
 * Description: Handles the hard delete comment logic for the application.
 * Keywords: harddeletecomment, hard, delete, comment, auto-annotated
 */
export const hardDeleteComment = async (req: AuthRequest, res: Response): Promise<void> => {
  return handleAdminAction(
    req,
    res,
    'Comment',
    'HARD_DELETE',
    /**
     * Callers: [handleAdminAction]
     * Callees: [findUnique]
     * Description: An anonymous callback to find a comment by id.
     * Keywords: admin, comment, find, anonymous
     */
    (id) => prisma.comment.findUnique({ where: { id }, include: { post: true } }),
    /**
     * Callers: [handleAdminAction]
     * Callees: [delete]
     * Description: An anonymous callback to hard delete a comment.
     * Keywords: admin, comment, delete, anonymous
     */
    (id) => prisma.comment.delete({ where: { id } }),
    'Comment permanently deleted'
  );
};

// Database Config
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';

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
 * Callees: [json, status, encodeURIComponent, $connect, $disconnect, resolve, cwd, catch, readFile, includes, replace, writeFile, exec, error, logAudit, setTimeout, exit]
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
    const tempPrisma = new PrismaClient({ datasources: { db: { url: newDbUrl } } });
    await tempPrisma.$connect();
    await tempPrisma.$disconnect();

    const envPath = path.resolve(process.cwd(), '../../.env');
    /**
     * Callers: [updateDbConfig]
     * Callees: []
     * Description: An anonymous error handler callback returning an empty string.
     * Keywords: admin, file, catch, empty, anonymous
     */
    let envContent = await fs.readFile(envPath, 'utf8').catch(() => '');
    
    if (envContent.includes('DATABASE_URL=')) {
      envContent = envContent.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${newDbUrl}"`);
    } else {
      envContent += `\nDATABASE_URL="${newDbUrl}"`;
    }
    
    await fs.writeFile(envPath, envContent);
    process.env.DATABASE_URL = newDbUrl;

    /**
     * Callers: [updateDbConfig]
     * Callees: [error, json, status, setTimeout, exit]
     * Description: An anonymous callback executed after prisma db push completes.
     * Keywords: admin, exec, prisma, push, callback, anonymous
     */
    exec('npx prisma db push', { cwd: process.cwd() }, async (err, stdout, stderr) => {
      if (err) {
        console.error('Prisma Error on DB Update:', stderr || err.message);
        res.status(500).json({ error: '数据库初始化失败，请检查连接或权限。' });
        return;
      }

      await logAudit(operatorId, 'UPDATE_DB_CONFIG', 'PostgreSQL config updated in .env');
      res.json({ message: 'Database configuration updated successfully', config: { host, port, username, password, database } });

      /**
       * Callers: [exec]
       * Callees: [exit]
       * Description: An anonymous timeout callback that forcefully restarts the server.
       * Keywords: admin, restart, exit, timeout, anonymous
       */
      setTimeout(() => {
        process.exit(0);
      }, 1000);
    });
  } catch (error) {
    console.error('DB Connection Test Failed:', error);
    res.status(500).json({ error: 'ERR_DB_CONNECTION_FAILED' });
  }
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
    const routes = await prisma.routeWhitelist.findMany({
      orderBy: { createdAt: 'asc' }
    });
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

    const route = await prisma.routeWhitelist.create({
      data: { path, isPrefix: !!isPrefix, minRole: minRole || null, description }
    });
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

    const route = await prisma.routeWhitelist.update({
      where: { id },
      data: { path, isPrefix: !!isPrefix, minRole: minRole || null, description }
    });
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
    await prisma.routeWhitelist.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete route whitelist' });
  }
};

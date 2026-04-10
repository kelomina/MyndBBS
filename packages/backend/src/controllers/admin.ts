import { revokeUserSessions } from '../lib/session';
import { Request, Response } from 'express';
import { prisma } from '../db';
import { UserStatus, PostStatus } from '@prisma/client';
import { redis } from '../lib/redis';
import { logAudit } from '../lib/audit';
import { AuthRequest } from '../middleware/auth';

// Users

// Role levels
export const ROLE_LEVELS: Record<string, number> = {
  'SUPER_ADMIN': 4,
  'ADMIN': 3,
  'MODERATOR': 2,
  'USER': 1
};


export const getUsers = async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true, role: { select: { name: true } }, status: true, createdAt: true }
  });
  const formattedUsers = users.map(user => ({
    ...user,
    role: user.role?.name || null
  }));
  res.json(formattedUsers);
};

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

    

    const currentRoleLevel = ROLE_LEVELS[currentUser.role?.name || 'USER'] || 1;
    const newRoleLevel = ROLE_LEVELS[role] || 1;

    // Prevent managing users with equal or higher roles than the operator
    const operatorRoleLevel = ROLE_LEVELS[req.user?.role || 'USER'] || 1;
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
      await revokeUserSessions(id);
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
        await revokeUserSessions(rootUser.id);
        await logAudit('system', 'AUTO_DISABLE_ROOT', 'root');
      }
    }

    await logAudit(operatorId, 'UPDATE_USER_ROLE', `User:${id} to ${role}`);
  }

  res.json({ message: 'User updated', user: { id: finalUser.id, role: finalUser.role?.name, level: (finalUser as any).level } });
};

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

  
  const targetRoleLevel = ROLE_LEVELS[targetUser.role?.name || 'USER'] || 1;
  const operatorRoleLevel = ROLE_LEVELS[req.user?.role || 'USER'] || 1;

  if (targetRoleLevel >= operatorRoleLevel && req.user?.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'ERR_FORBIDDEN_CANNOT_MANAGE_USER_WITH_EQUAL_OR_HIGHER_ROLE' });
    return;
  }

  const user = await prisma.user.update({ where: { id }, data: { status } });

  if (status === UserStatus.BANNED) {
    // Revoke sessions on ban
    await revokeUserSessions(id);
  }

  await logAudit(operatorId, 'UPDATE_USER_STATUS', `User:${id} to ${status}`);

  res.json({ message: 'Status updated', user: { id: user.id, status: user.status } });
};

// Categories
export const getCategories = async (req: Request, res: Response) => {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json(categories);
};

export const createCategory = async (req: AuthRequest, res: Response) => {
  const { name, description, sortOrder, minLevel } = req.body;
  const operatorId = req.user?.userId || 'unknown';

  const category = await prisma.category.create({
    data: { name, description, sortOrder: sortOrder || 0, minLevel: minLevel || 0 }
  });

  await logAudit(operatorId, 'CREATE_CATEGORY', `Category:${category.id}`);

  res.status(201).json(category);
};

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
export const getPosts = async (req: AuthRequest, res: Response) => {
  const { accessibleBy } = await import('@casl/prisma');
  
  if (!req.ability) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }

  const posts = await prisma.post.findMany({
    where: accessibleBy(req.ability, 'read').Post,
    include: { author: { select: { username: true } }, category: { select: { name: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(posts);
};

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
export const getDeletedPosts = async (req: AuthRequest, res: Response) => {
  const { accessibleBy } = await import('@casl/prisma');
  if (!req.ability) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }
  const posts = await prisma.post.findMany({
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

export const getDeletedComments = async (req: AuthRequest, res: Response) => {
  const { accessibleBy } = await import('@casl/prisma');
  if (!req.ability) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }
  const comments = await prisma.comment.findMany({
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

export const restorePost = async (req: AuthRequest, res: Response): Promise<void> => {
  return handleAdminAction(
    req, res, 'Post', 'RESTORE',
    (id) => prisma.post.findUnique({ where: { id } }),
    (id) => prisma.post.update({ where: { id }, data: { status: PostStatus.PUBLISHED } }),
    'Post restored'
  );
};

export const hardDeletePost = async (req: AuthRequest, res: Response): Promise<void> => {
  return handleAdminAction(
    req, res, 'Post', 'HARD_DELETE',
    (id) => prisma.post.findUnique({ where: { id } }),
    (id) => prisma.post.delete({ where: { id } }),
    'Post permanently deleted'
  );
};

export const restoreComment = async (req: AuthRequest, res: Response): Promise<void> => {
  return handleAdminAction(
    req, res, 'Comment', 'RESTORE',
    (id) => prisma.comment.findUnique({ where: { id }, include: { post: true } }),
    (id) => prisma.comment.update({ where: { id }, data: { deletedAt: null } }),
    'Comment restored'
  );
};

export const hardDeleteComment = async (req: AuthRequest, res: Response): Promise<void> => {
  return handleAdminAction(
    req, res, 'Comment', 'HARD_DELETE',
    (id) => prisma.comment.findUnique({ where: { id }, include: { post: true } }),
    (id) => prisma.comment.delete({ where: { id } }),
    'Comment permanently deleted'
  );
};

// Database Config
import fs from 'fs/promises';
import path from 'path';

const DB_CONFIG_PATH = path.join(process.cwd(), 'db_config.json');

export const getDbConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'ERR_FORBIDDEN_SUPER_ADMIN_ONLY' });
    return;
  }
  
  try {
    const data = await fs.readFile(DB_CONFIG_PATH, 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    // If file doesn't exist, return default empty config
    res.json({
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: '',
      database: 'myndbbs'
    });
  }
};

export const updateDbConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'ERR_FORBIDDEN_SUPER_ADMIN_ONLY' });
    return;
  }

  const { host, port, username, password, database } = req.body;
  const operatorId = req.user?.userId || 'unknown';

  try {
    const config = { host, port, username, password, database };
    await fs.writeFile(DB_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    await logAudit(operatorId, 'UPDATE_DB_CONFIG', 'MySQL config updated');
    res.json({ message: 'Database configuration updated successfully', config });
  } catch (error) {
    res.status(500).json({ error: 'ERR_FAILED_TO_UPDATE_DB_CONFIG' });
  }
};

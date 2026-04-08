import { Request, Response } from 'express';
import { prisma } from '../db';
import { redis } from '../lib/redis';
import { logAudit } from '../lib/audit';
import { AuthRequest } from '../middleware/auth';

// Users
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
  const { role } = req.body;
  const operatorId = req.user?.userId || 'unknown';

  if (!['USER', 'ADMIN', 'MODERATOR', 'SUPER_ADMIN'].includes(role)) {
    res.status(400).json({ error: 'Invalid role' });
    return;
  }
  
  const roleRecord = await prisma.role.findUnique({ where: { name: role } });
  if (!roleRecord) {
    res.status(400).json({ error: 'Role not found in database' });
    return;
  }

  const currentUser = await prisma.user.findUnique({
    where: { id },
    include: { role: true }
  });

  if (!currentUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const user = await prisma.user.update({ 
    where: { id }, 
    data: { roleId: roleRecord.id },
    include: { role: true }
  });

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
    res.status(403).json({ error: 'Forbidden: Cannot manage user with equal or higher role' });
    return;
  }

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
  if (role === 'SUPER_ADMIN' && user.username !== 'root') {
    const rootUser = await prisma.user.findFirst({
      where: { username: 'root', status: { not: 'BANNED' } }
    });
    if (rootUser) {
      await prisma.user.update({
        where: { id: rootUser.id },
        data: { status: 'BANNED' }
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

  res.json({ message: 'Role updated', user: { id: user.id, role: user.role?.name } });
};

export const updateUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { status } = req.body;
  const operatorId = req.user?.userId || 'unknown';

  if (!['ACTIVE', 'BANNED', 'PENDING'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const targetUser = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!targetUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const roleLevels: Record<string, number> = { 'SUPER_ADMIN': 4, 'ADMIN': 3, 'MODERATOR': 2, 'USER': 1 };
  const targetRoleLevel = roleLevels[targetUser.role?.name || 'USER'] || 1;
  const operatorRoleLevel = roleLevels[req.user?.role || 'USER'] || 1;

  if (targetRoleLevel >= operatorRoleLevel && req.user?.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Forbidden: Cannot manage user with equal or higher role' });
    return;
  }

  const user = await prisma.user.update({ where: { id }, data: { status } });

  if (status === 'BANNED') {
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
export const getCategories = async (req: Request, res: Response) => {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json(categories);
};

export const createCategory = async (req: AuthRequest, res: Response) => {
  const { name, description, sortOrder } = req.body;
  const operatorId = req.user?.userId || 'unknown';

  const category = await prisma.category.create({
    data: { name, description, sortOrder: sortOrder || 0 }
  });

  await logAudit(operatorId, 'CREATE_CATEGORY', `Category:${category.id}`);

  res.status(201).json(category);
};

export const deleteCategory = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const operatorId = req.user?.userId || 'unknown';

  await prisma.category.delete({ where: { id } });

  await logAudit(operatorId, 'DELETE_CATEGORY', `Category:${id}`);

  res.json({ message: 'Category deleted' });
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
      res.status(400).json({ error: 'User not found or is not a MODERATOR' });
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
    res.status(500).json({ error: 'Server error' });
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
    res.status(500).json({ error: 'Server error' });
  }
};

// Posts
export const getPosts = async (req: AuthRequest, res: Response) => {
  const { accessibleBy } = await import('@casl/prisma');
  
  if (!req.ability) {
    res.status(401).json({ error: 'Unauthorized' });
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

  if (!['PUBLISHED', 'HIDDEN', 'PINNED'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const existingPost = await prisma.post.findUnique({ where: { id } });
  if (!existingPost) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  const { subject } = await import('@casl/ability');
  if (!req.ability?.can('update_status', subject('Post', existingPost as any))) {
    res.status(403).json({ error: 'Forbidden: Insufficient permissions to manage this post' });
    return;
  }

  const post = await prisma.post.update({ where: { id }, data: { status } });

  await logAudit(operatorId, 'UPDATE_POST_STATUS', `Post:${id} to ${status}`);

  res.json({ message: 'Post status updated', post });
};

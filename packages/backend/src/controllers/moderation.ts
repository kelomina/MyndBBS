import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';
import { clearModerationCache } from '../lib/moderation';
import { sendNotification } from '../lib/notification';

export const getModeratedWords = async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true, moderatedCategories: true }
  });

  const isSuperAdmin = user?.role?.name === 'SUPER_ADMIN' || user?.role?.name === 'ADMIN';
  const categoryIds = isSuperAdmin ? undefined : user?.moderatedCategories.map(c => c.categoryId);

  const words = await prisma.moderatedWord.findMany({
    where: categoryIds ? {
      OR: [
        { categoryId: null },
        { categoryId: { in: categoryIds } }
      ]
    } : {},
    include: { category: { select: { name: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ words });
};

export const addModeratedWord = async (req: AuthRequest, res: Response): Promise<void> => {
  const { word, categoryId } = req.body;
  if (!word) {
    res.status(400).json({ error: 'ERR_MISSING_WORD' });
    return;
  }
  
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true, moderatedCategories: true }
  });

  const isSuperAdmin = user?.role?.name === 'SUPER_ADMIN' || user?.role?.name === 'ADMIN';
  
  if (!isSuperAdmin) {
    if (!categoryId) {
      res.status(403).json({ error: 'ERR_CANNOT_ADD_GLOBAL_WORD' });
      return;
    }
    const isMod = user?.moderatedCategories.some(c => c.categoryId === categoryId);
    if (!isMod) {
      res.status(403).json({ error: 'ERR_NOT_MODERATOR_OF_CATEGORY' });
      return;
    }
  }

  try {
    const newWord = await prisma.moderatedWord.create({
      data: {
        word,
        categoryId: categoryId || null
      }
    });
    await clearModerationCache();
    res.json({ word: newWord });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'ERR_WORD_ALREADY_EXISTS' });
      return;
    }
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

export const deleteModeratedWord = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true, moderatedCategories: true }
  });

  const isSuperAdmin = user?.role?.name === 'SUPER_ADMIN' || user?.role?.name === 'ADMIN';

  const word = await prisma.moderatedWord.findUnique({ where: { id } });
  if (!word) {
    res.status(404).json({ error: 'ERR_WORD_NOT_FOUND' });
    return;
  }

  if (!isSuperAdmin) {
    if (!word.categoryId) {
      res.status(403).json({ error: 'ERR_CANNOT_DELETE_GLOBAL_WORD' });
      return;
    }
    const isMod = user?.moderatedCategories.some(c => c.categoryId === word.categoryId);
    if (!isMod) {
      res.status(403).json({ error: 'ERR_NOT_MODERATOR_OF_CATEGORY' });
      return;
    }
  }

  try {
    await prisma.moderatedWord.delete({ where: { id } });
    await clearModerationCache();
    res.json({ message: 'Word deleted successfully' });
  } catch (error) {
    res.status(404).json({ error: 'ERR_WORD_NOT_FOUND' });
  }
};

// Queue endpoints
export const getPendingPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true, moderatedCategories: true }
  });

  const isSuperAdmin = user?.role?.name === 'SUPER_ADMIN' || user?.role?.name === 'ADMIN';
  const categoryIds = isSuperAdmin ? undefined : user?.moderatedCategories.map(c => c.categoryId);

  const posts = await prisma.post.findMany({
    where: {
      status: 'PENDING',
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {})
    },
    include: {
      author: { select: { username: true } },
      category: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  res.json({ posts });
};

export const approvePendingPost = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  try {
    const post = await prisma.post.update({
      where: { id },
      data: { status: 'PUBLISHED' }
    });
    
    await sendNotification({
      userId: post.authorId,
      type: 'POST_APPROVED',
      title: 'Post Approved',
      content: `Your post "${post.title}" has been approved.`,
      relatedId: post.id
    });
    
    res.json({ message: 'Post approved' });
  } catch (error) {
    res.status(404).json({ error: 'ERR_POST_NOT_FOUND' });
  }
};

export const rejectPendingPost = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { reason } = req.body;
  try {
    const post = await prisma.post.update({
      where: { id },
      data: { status: 'DELETED' }
    });
    
    await sendNotification({
      userId: post.authorId,
      type: 'POST_REJECTED',
      title: 'Post Rejected',
      content: `Your post "${post.title}" has been rejected. Reason: ${reason || 'N/A'}`,
      relatedId: post.id
    });
    
    res.json({ message: 'Post rejected' });
  } catch (error) {
    res.status(404).json({ error: 'ERR_POST_NOT_FOUND' });
  }
};

export const getPendingComments = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true, moderatedCategories: true }
  });

  const isSuperAdmin = user?.role?.name === 'SUPER_ADMIN' || user?.role?.name === 'ADMIN';
  const categoryIds = isSuperAdmin ? undefined : user?.moderatedCategories.map(c => c.categoryId);

  const comments = await prisma.comment.findMany({
    where: {
      isPending: true,
      deletedAt: null,
      ...(categoryIds ? { post: { categoryId: { in: categoryIds } } } : {})
    },
    include: {
      author: { select: { username: true } },
      post: { select: { title: true, id: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  res.json({ comments });
};

export const approvePendingComment = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  try {
    await prisma.comment.update({
      where: { id },
      data: { isPending: false }
    });
    res.json({ message: 'Comment approved' });
  } catch (error) {
    res.status(404).json({ error: 'ERR_COMMENT_NOT_FOUND' });
  }
};

export const rejectPendingComment = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  try {
    await prisma.comment.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    res.json({ message: 'Comment rejected' });
  } catch (error) {
    res.status(404).json({ error: 'ERR_COMMENT_NOT_FOUND' });
  }
};

import { Response, NextFunction } from 'express';
import { prisma } from '../db';
import { AuthRequest } from './auth';

export const requirePostOwnershipOrAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const postId = req.params.id as string;
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (user.role === 'ADMIN') {
      next();
      return;
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        category: {
          include: {
            moderators: true
          }
        }
      }
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Check ownership
    if (post.authorId === user.userId) {
      next();
      return;
    }

    // Check moderator status
    if (user.role === 'MODERATOR') {
      const isMod = post.category.moderators.some((mod: any) => mod.userId === user.userId);
      if (isMod) {
        next();
        return;
      }
    }

    res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
  } catch (error) {
    next(error);
  }
};

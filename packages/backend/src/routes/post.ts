import { Router, Response } from 'express';
import { requireAuth, requireAbility, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import { subject } from '@casl/ability';

const router: Router = Router();

router.delete('/:id', requireAuth, requireAbility('delete', 'Post'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Instance-level authorization check
    if (!req.ability?.can('delete', subject('Post', post as any))) {
      res.status(403).json({ error: 'Forbidden: Insufficient permissions to delete this post' });
      return;
    }

    await prisma.post.delete({ where: { id: postId } });
    res.json({ message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

export default router;

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requirePostOwnershipOrAdmin } from '../middleware/abac';
import { prisma } from '../db';

const router: Router = Router();

router.delete('/:id', requireAuth, requirePostOwnershipOrAdmin, async (req, res) => {
  try {
    const postId = req.params.id as string;
    await prisma.post.delete({ where: { id: postId } });
    res.json({ message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

export default router;

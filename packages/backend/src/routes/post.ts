import { Router, Response, Request } from 'express';
import { requireAuth, requireAbility, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import { subject } from '@casl/ability';

const router: Router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;
    const whereClause: any = {};
    
    if (category && typeof category === 'string') {
      whereClause.category = {
        name: category
      };
    }

    const posts = await prisma.post.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, username: true }
        },
        category: {
          select: { id: true, name: true, description: true }
        }
      }
    });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

router.post('/', requireAuth, requireAbility('create', 'Post'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, content, categoryId } = req.body;
    
    if (!title || !content || !categoryId) {
      res.status(400).json({ error: 'Title, content, and categoryId are required' });
      return;
    }

    const post = await prisma.post.create({
      data: {
        title,
        content,
        categoryId,
        authorId: req.user!.userId
      },
      include: {
        author: {
          select: { id: true, username: true }
        },
        category: {
          select: { id: true, name: true, description: true }
        }
      }
    });

    res.status(201).json(post);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

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

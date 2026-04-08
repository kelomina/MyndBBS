import { Router, Response, Request } from 'express';
import { requireAuth, requireAbility, optionalAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import { subject } from '@casl/ability';
import { accessibleBy } from '@casl/prisma';

const router: Router = Router();

router.get('/', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category, sortBy } = req.query;
    
    // Base accessibility check
    const whereClause: any = {
      AND: [
        accessibleBy(req.ability!).Post
      ]
    };
    
    if (category && typeof category === 'string') {
      whereClause.AND.push({
        category: { name: category }
      });
    }

    let orderByClause: any = { createdAt: 'desc' }; // default to latest
    if (sortBy === 'popular') {
      // Since we don't have upvotes or view metrics yet in the database, 
      // we'll just sort by title or id for now to show a different order.
      // Alternatively, we could just fallback to ascending order of creation date for 'popular' to differentiate from 'latest'.
      orderByClause = { id: 'asc' }; 
    }

    const posts = await prisma.post.findMany({
      where: whereClause,
      orderBy: orderByClause,
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

router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    
    const post = await prisma.post.findFirst({
      where: { 
        AND: [
          { id: postId },
          accessibleBy(req.ability!).Post
        ]
      },
      include: {
        author: {
          select: { id: true, username: true }
        },
        category: {
          select: { id: true, name: true, description: true }
        },
        _count: {
          select: { comments: true, upvotes: true, bookmarks: true }
        }
      }
    });

    if (!post) {
      res.status(403).json({ error: 'Post not found or access denied' });
      return;
    }

    res.json(post);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Get interaction status for a post (if upvoted/bookmarked by current user)
router.get('/:id/interactions', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    const userId = req.user!.userId;

    const post = await prisma.post.findFirst({
      where: {
        AND: [
          { id: postId },
          accessibleBy(req.ability!).Post
        ]
      }
    });

    if (!post) {
      res.status(403).json({ error: 'Post not found or access denied' });
      return;
    }

    const [upvote, bookmark] = await Promise.all([
      prisma.upvote.findUnique({
        where: { userId_postId: { userId, postId } }
      }),
      prisma.bookmark.findUnique({
        where: { userId_postId: { userId, postId } }
      })
    ]);

    res.json({
      upvoted: !!upvote,
      bookmarked: !!bookmark
    });
  } catch (error) {
    console.error('Error fetching interactions:', error);
    res.status(500).json({ error: 'Failed to fetch interaction status' });
  }
});

// Toggle upvote
router.post('/:id/upvote', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    const userId = req.user!.userId;

    const post = await prisma.post.findFirst({
      where: {
        AND: [
          { id: postId },
          accessibleBy(req.ability!).Post
        ]
      }
    });

    if (!post) {
      res.status(403).json({ error: 'Post not found or access denied' });
      return;
    }

    const existingUpvote = await prisma.upvote.findUnique({
      where: { userId_postId: { userId, postId } }
    });

    if (existingUpvote) {
      await prisma.upvote.delete({
        where: { userId_postId: { userId, postId } }
      });
      res.json({ upvoted: false });
    } else {
      await prisma.upvote.create({
        data: { userId, postId }
      });
      res.json({ upvoted: true });
    }
  } catch (error) {
    console.error('Error toggling upvote:', error);
    res.status(500).json({ error: 'Failed to toggle upvote' });
  }
});

// Toggle bookmark
router.post('/:id/bookmark', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    const userId = req.user!.userId;

    const post = await prisma.post.findFirst({
      where: {
        AND: [
          { id: postId },
          accessibleBy(req.ability!).Post
        ]
      }
    });

    if (!post) {
      res.status(403).json({ error: 'Post not found or access denied' });
      return;
    }

    const existingBookmark = await prisma.bookmark.findUnique({
      where: { userId_postId: { userId, postId } }
    });

    if (existingBookmark) {
      await prisma.bookmark.delete({
        where: { userId_postId: { userId, postId } }
      });
      res.json({ bookmarked: false });
    } else {
      await prisma.bookmark.create({
        data: { userId, postId }
      });
      res.json({ bookmarked: true });
    }
  } catch (error) {
    console.error('Error toggling bookmark:', error);
    res.status(500).json({ error: 'Failed to toggle bookmark' });
  }
});

// GET comments for a post
router.get('/:id/comments', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    
    // Verify user can read the post
    const post = await prisma.post.findFirst({
      where: {
        AND: [
          { id: postId },
          accessibleBy(req.ability!).Post
        ]
      }
    });

    if (!post) {
      res.status(403).json({ error: 'Post not found or access denied' });
      return;
    }

    const comments = await prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
          select: { id: true, username: true }
        },
        _count: {
          select: { upvotes: true, bookmarks: true, replies: true }
        }
      }
    });

    // If user is logged in, attach their interaction status
    let interactedUpvotes = new Set<string>();
    let interactedBookmarks = new Set<string>();

    if (req.user?.userId) {
      const userId = req.user.userId;
      const [userUpvotes, userBookmarks] = await Promise.all([
        prisma.commentUpvote.findMany({
          where: { userId, comment: { postId } },
          select: { commentId: true }
        }),
        prisma.commentBookmark.findMany({
          where: { userId, comment: { postId } },
          select: { commentId: true }
        })
      ]);
      userUpvotes.forEach(u => interactedUpvotes.add(u.commentId));
      userBookmarks.forEach(b => interactedBookmarks.add(b.commentId));
    }

    const formattedComments = comments.map(comment => ({
      ...comment,
      hasUpvoted: interactedUpvotes.has(comment.id),
      hasBookmarked: interactedBookmarks.has(comment.id)
    }));

    res.json(formattedComments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST a comment to a post
router.post('/:id/comments', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    const { content, parentId } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Comment content is required' });
      return;
    }

    const post = await prisma.post.findFirst({
      where: {
        AND: [
          { id: postId },
          accessibleBy(req.ability!).Post
        ]
      }
    });

    if (!post) {
      res.status(403).json({ error: 'Post not found or access denied' });
      return;
    }

    if (parentId) {
      const parentComment = await prisma.comment.findUnique({ where: { id: parentId } });
      if (!parentComment || parentComment.postId !== postId) {
        res.status(400).json({ error: 'Invalid parent comment' });
        return;
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        postId,
        parentId: parentId || null,
        authorId: req.user!.userId
      },
      include: {
        author: {
          select: { id: true, username: true }
        },
        _count: {
          select: { upvotes: true, bookmarks: true, replies: true }
        }
      }
    });

    res.status(201).json({ ...comment, hasUpvoted: false, hasBookmarked: false });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
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

// Comment upvote
router.post('/comments/:commentId/upvote', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const commentId = req.params.commentId as string;
    const userId = req.user!.userId;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { post: true }
    });

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    // Verify user can read the post this comment belongs to
    if (!req.ability?.can('read', subject('Post', comment.post as any))) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const existingUpvote = await prisma.commentUpvote.findUnique({
      where: { userId_commentId: { userId, commentId } }
    });

    if (existingUpvote) {
      await prisma.commentUpvote.delete({
        where: { userId_commentId: { userId, commentId } }
      });
      res.json({ upvoted: false });
    } else {
      await prisma.commentUpvote.create({
        data: { userId, commentId }
      });
      res.json({ upvoted: true });
    }
  } catch (error) {
    console.error('Error toggling comment upvote:', error);
    res.status(500).json({ error: 'Failed to toggle comment upvote' });
  }
});

// Comment bookmark
router.post('/comments/:commentId/bookmark', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const commentId = req.params.commentId as string;
    const userId = req.user!.userId;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { post: true }
    });

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    // Verify user can read the post this comment belongs to
    if (!req.ability?.can('read', subject('Post', comment.post as any))) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const existingBookmark = await prisma.commentBookmark.findUnique({
      where: { userId_commentId: { userId, commentId } }
    });

    if (existingBookmark) {
      await prisma.commentBookmark.delete({
        where: { userId_commentId: { userId, commentId } }
      });
      res.json({ bookmarked: false });
    } else {
      await prisma.commentBookmark.create({
        data: { userId, commentId }
      });
      res.json({ bookmarked: true });
    }
  } catch (error) {
    console.error('Error toggling comment bookmark:', error);
    res.status(500).json({ error: 'Failed to toggle comment bookmark' });
  }
});

export default router;

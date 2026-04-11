import { Router, Response, Request } from 'express';
import { requireAuth, requireAbility, optionalAuth, AuthRequest } from '../middleware/auth';
import { PostStatus } from '@prisma/client';
import { prisma } from '../db';
import { containsModeratedWord } from '../lib/moderation';
import { notifyModerators } from '../lib/notification';
import { subject } from '@casl/ability';
import { accessibleBy } from '@casl/prisma';
import { sendNotification } from '../lib/notification';

import { verifyAndConsumeCaptcha } from '../controllers/captcha';
import { AppAbility } from '../lib/casl';

const getAccessiblePost = async (postId: string, ability: AppAbility) => {
  return prisma.post.findFirst({
    where: {
      AND: [
        { id: postId },
        accessibleBy(ability).Post
      ]
    }
  });
};


const getCommentWithPost = async (commentId: string) => {
  return prisma.comment.findUnique({
    where: { id: commentId },
    include: { post: true }
  });
};


// Helper for interaction toggles
const toggleInteraction = async (
  req: AuthRequest,
  res: Response,
  modelDelegate: any,
  whereCondition: any,
  createData: any,
  statusKey: string,
  errorMessage: string
) => {
  try {
    const existing = await modelDelegate.findUnique({
      where: whereCondition
    });

    if (existing) {
      await modelDelegate.delete({
        where: whereCondition
      });
      res.json({ [statusKey]: false });
    } else {
      await modelDelegate.create({
        data: createData
      });
      res.json({ [statusKey]: true });
    }
  } catch (error) {
    console.error(`Error toggling ${statusKey}:`, error);
    res.status(500).json({ error: errorMessage });
  }
};

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
    
    if (category) {
      whereClause.AND.push({
        category: { name: String(category) }
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
        },
        _count: {
          select: { comments: true, upvotes: true }
        }
      }
    });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_POSTS' });
  }
});

router.post('/', requireAuth, requireAbility('create', 'Post'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, content, categoryId, captchaId } = req.body;
    
    if (!title || !content || !categoryId) {
      res.status(400).json({ error: 'ERR_TITLE_CONTENT_AND_CATEGORYID_ARE_REQUIRED' });
      return;
    }

    if (!captchaId) {
      res.status(400).json({ error: 'ERR_CAPTCHA_IS_REQUIRED' });
      return;
    }

    const isCaptchaValid = await verifyAndConsumeCaptcha(captchaId);
    if (!isCaptchaValid) {
      res.status(400).json({ error: 'ERR_INVALID_OR_EXPIRED_CAPTCHA' });
      return;
    }

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      res.status(404).json({ error: 'ERR_CATEGORY_NOT_FOUND' });
      return;
    }
    const currentUser = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if ((currentUser?.level || 1) < category.minLevel) {
      res.status(403).json({ error: 'ERR_INSUFFICIENT_LEVEL_TO_POST_IN_THIS_CATEGORY' });
      return;
    }

    
    const isModerated = await containsModeratedWord(title + ' ' + content, categoryId);
    const status = isModerated ? 'PENDING' : 'PUBLISHED';

    const post = await prisma.post.create({
      data: {
        title,
        content,
        categoryId,
        authorId: req.user!.userId,
        status,
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

    if (isModerated) {
      res.status(201).json({ message: 'ERR_PENDING_MODERATION', post });
      return;
    }

    res.status(201).json(post);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_CREATE_POST' });
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
      res.status(403).json({ error: 'ERR_POST_NOT_FOUND_OR_ACCESS_DENIED' });
      return;
    }

    res.json(post);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_POST' });
  }
});

// Get interaction status for a post (if upvoted/bookmarked by current user)
router.get('/:id/interactions', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    const userId = req.user!.userId;

    const post = await getAccessiblePost(postId, req.ability!);

    if (!post) {
      res.status(403).json({ error: 'ERR_POST_NOT_FOUND_OR_ACCESS_DENIED' });
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
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_INTERACTION_STATUS' });
  }
});

// Toggle upvote
router.post('/:id/upvote', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    const userId = req.user!.userId;

    const post = await getAccessiblePost(postId, req.ability!);

    if (!post) {
      res.status(403).json({ error: 'ERR_POST_NOT_FOUND_OR_ACCESS_DENIED' });
      return;
    }

    return toggleInteraction(
      req, res, prisma.upvote,
      { userId_postId: { userId, postId } },
      { userId, postId },
      'upvoted',
      'ERR_FAILED_TO_TOGGLE_UPVOTE'
    );
  } catch (error) {
    console.error('Error toggling upvote:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_TOGGLE_UPVOTE' });
  }
});

// Toggle bookmark
router.post('/:id/bookmark', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    const userId = req.user!.userId;

    const post = await getAccessiblePost(postId, req.ability!);

    if (!post) {
      res.status(403).json({ error: 'ERR_POST_NOT_FOUND_OR_ACCESS_DENIED' });
      return;
    }

    return toggleInteraction(
      req, res, prisma.bookmark,
      { userId_postId: { userId, postId } },
      { userId, postId },
      'bookmarked',
      'ERR_FAILED_TO_TOGGLE_BOOKMARK'
    );
  } catch (error) {
    console.error('Error toggling bookmark:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_TOGGLE_BOOKMARK' });
  }
});

// GET comments for a post
router.get('/:id/comments', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    
    // Verify user can read the post
    const post = await getAccessiblePost(postId, req.ability!);

    if (!post) {
      res.status(403).json({ error: 'ERR_POST_NOT_FOUND_OR_ACCESS_DENIED' });
      return;
    }

    const comments = await prisma.comment.findMany({
      where: {
        AND: [
          { postId },
          accessibleBy(req.ability!).Comment
        ]
      },
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
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_COMMENTS' });
  }
});

// POST a comment to a post
router.post('/:id/comments', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    const { content, parentId, captchaId } = req.body;

    if (!content) {
      res.status(400).json({ error: 'ERR_COMMENT_CONTENT_IS_REQUIRED' });
      return;
    }

    if (!captchaId) {
      res.status(400).json({ error: 'ERR_CAPTCHA_IS_REQUIRED' });
      return;
    }

    const isCaptchaValid = await verifyAndConsumeCaptcha(captchaId);
    if (!isCaptchaValid) {
      res.status(400).json({ error: 'ERR_INVALID_OR_EXPIRED_CAPTCHA' });
      return;
    }

    const post = await getAccessiblePost(postId, req.ability!);

    if (!post) {
      res.status(403).json({ error: 'ERR_POST_NOT_FOUND_OR_ACCESS_DENIED' });
      return;
    }

    if (parentId) {
      const parentComment = await prisma.comment.findUnique({ where: { id: parentId } });
      if (!parentComment || parentComment.postId !== postId) {
        res.status(400).json({ error: 'ERR_INVALID_PARENT_COMMENT' });
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

    const postObj = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true, title: true } });
    if (postObj && postObj.authorId !== req.user!.userId) {
      await sendNotification({
        userId: postObj.authorId,
        type: 'POST_REPLIED',
        title: 'New Reply to Your Post',
        content: `Someone replied to your post "${postObj.title}".`,
        relatedId: postId
      });
    }
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({ where: { id: parentId }, select: { authorId: true } });
      if (parentComment && parentComment.authorId !== req.user!.userId) {
        await sendNotification({
          userId: parentComment.authorId,
          type: 'COMMENT_REPLIED',
          title: 'New Reply to Your Comment',
          content: `Someone replied to your comment on a post.`,
          relatedId: postId
        });
      }
    }

    res.status(201).json({ ...comment, hasUpvoted: false, hasBookmarked: false });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_CREATE_COMMENT' });
  }
});

router.put('/:id', requireAuth, requireAbility('update', 'Post'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    const { title, content, categoryId } = req.body;
    
    if (!title || !content || !categoryId) {
      res.status(400).json({ error: 'ERR_TITLE_CONTENT_AND_CATEGORYID_ARE_REQUIRED' });
      return;
    }

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      res.status(404).json({ error: 'ERR_CATEGORY_NOT_FOUND' });
      return;
    }
    const currentUser = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if ((currentUser?.level || 1) < category.minLevel) {
      res.status(403).json({ error: 'ERR_INSUFFICIENT_LEVEL_TO_POST_IN_THIS_CATEGORY' });
      return;
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { category: true }
    });

    if (!post) {
      res.status(404).json({ error: 'ERR_POST_NOT_FOUND' });
      return;
    }

    // Instance-level authorization check
    if (!req.ability?.can('update', subject('Post', post as any))) {
      res.status(403).json({ error: 'ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_EDIT_THIS_POST' });
      return;
    }

    
    let isModerated = false;
    let newStatus = post.status;
    if (title || content) {
      const checkTitle = title || post.title;
      const checkContent = content || post.content;
      isModerated = await containsModeratedWord(checkTitle + ' ' + checkContent, post.categoryId);
      if (isModerated) {
        newStatus = 'PENDING';
      }
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        title,
        content,
        categoryId,
        status: newStatus
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

    if (isModerated) {
      res.json({ message: 'ERR_PENDING_MODERATION', post: updatedPost });
      return;
    }

    res.json(updatedPost);
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_UPDATE_POST' });
  }
});

router.delete('/:id', requireAuth, requireAbility('delete', 'Post'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      res.status(404).json({ error: 'ERR_POST_NOT_FOUND' });
      return;
    }

    // Instance-level authorization check
    if (!req.ability?.can('delete', subject('Post', post as any))) {
      res.status(403).json({ error: 'ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_DELETE_THIS_POST' });
      return;
    }

    await prisma.$transaction([
      prisma.post.update({ where: { id: postId }, data: { status: PostStatus.DELETED } }),
      prisma.comment.updateMany({ where: { postId: postId }, data: { deletedAt: new Date() } })
    ]);
    res.json({ message: 'Post and its comments deleted' });
  } catch (error) {
    res.status(500).json({ error: 'ERR_FAILED_TO_DELETE_POST' });
  }
});

router.put('/comments/:commentId', requireAuth, requireAbility('update', 'Comment'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const commentId = req.params.commentId as string;
    const { content } = req.body;
    
    if (!content) {
      res.status(400).json({ error: 'ERR_CONTENT_IS_REQUIRED' });
      return;
    }

    const comment = await getCommentWithPost(commentId);

    if (!comment) {
      res.status(404).json({ error: 'ERR_COMMENT_NOT_FOUND' });
      return;
    }

    // Instance-level authorization check
    if (!req.ability?.can('update', subject('Comment', comment as any))) {
      res.status(403).json({ error: 'ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_EDIT_THIS_COMMENT' });
      return;
    }

    
    const isModerated = await containsModeratedWord(content, comment.post.categoryId);

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content,
        isPending: isModerated
      },
      include: {
        author: {
          select: { id: true, username: true }
        }
      }
    });

    if (isModerated) {
      res.json({ message: 'ERR_PENDING_MODERATION', comment: updatedComment });
      return;
    }

    res.json(updatedComment);
  } catch (error) {
    res.status(500).json({ error: 'ERR_FAILED_TO_UPDATE_COMMENT' });
  }
});

router.delete('/comments/:commentId', requireAuth, requireAbility('delete', 'Comment'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const commentId = req.params.commentId as string;
    
    const comment = await getCommentWithPost(commentId);

    if (!comment) {
      res.status(404).json({ error: 'ERR_COMMENT_NOT_FOUND' });
      return;
    }

    // Instance-level authorization check
    if (!req.ability?.can('delete', subject('Comment', comment as any))) {
      res.status(403).json({ error: 'ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_DELETE_THIS_COMMENT' });
      return;
    }

    await prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    res.status(500).json({ error: 'ERR_FAILED_TO_DELETE_COMMENT' });
  }
});

// Comment upvote
router.post('/comments/:commentId/upvote', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const commentId = req.params.commentId as string;
    const userId = req.user!.userId;

    const comment = await getCommentWithPost(commentId);

    if (!comment) {
      res.status(404).json({ error: 'ERR_COMMENT_NOT_FOUND' });
      return;
    }

    // Verify user can read the post this comment belongs to
    if (!req.ability?.can('read', subject('Post', comment.post as any))) {
      res.status(403).json({ error: 'ERR_FORBIDDEN' });
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
    res.status(500).json({ error: 'ERR_FAILED_TO_TOGGLE_COMMENT_UPVOTE' });
  }
});

// Comment bookmark
router.post('/comments/:commentId/bookmark', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const commentId = req.params.commentId as string;
    const userId = req.user!.userId;

    const comment = await getCommentWithPost(commentId);

    if (!comment) {
      res.status(404).json({ error: 'ERR_COMMENT_NOT_FOUND' });
      return;
    }

    // Verify user can read the post this comment belongs to
    if (!req.ability?.can('read', subject('Post', comment.post as any))) {
      res.status(403).json({ error: 'ERR_FORBIDDEN' });
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
    res.status(500).json({ error: 'ERR_FAILED_TO_TOGGLE_COMMENT_BOOKMARK' });
  }
});

export default router;

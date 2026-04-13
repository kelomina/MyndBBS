import { Router, Response, Request } from 'express';
import { requireAuth, requireAbility, optionalAuth, AuthRequest } from '../middleware/auth';
import { PostStatus } from '@prisma/client';
import { prisma } from '../db';
import { containsModeratedWord } from '../lib/moderation';
import { subject } from '@casl/ability';
import { accessibleBy } from '@casl/prisma';
import { globalEventBus } from '../infrastructure/events/InMemoryEventBus';
import { PostRepliedEvent, CommentRepliedEvent } from '../domain/shared/events/DomainEvents';

import { PrismaPostRepository } from '../infrastructure/repositories/PrismaPostRepository';
import { PrismaCommentRepository } from '../infrastructure/repositories/PrismaCommentRepository';
import { PrismaCategoryRepository } from '../infrastructure/repositories/PrismaCategoryRepository';
import { PrismaEngagementRepository } from '../infrastructure/repositories/PrismaEngagementRepository';
import { CommunityApplicationService } from '../application/community/CommunityApplicationService';
import { AuthApplicationService } from '../application/identity/AuthApplicationService';
import { PrismaCaptchaChallengeRepository } from '../infrastructure/repositories/PrismaCaptchaChallengeRepository';
import { PrismaPasskeyRepository } from '../infrastructure/repositories/PrismaPasskeyRepository';
import { PrismaSessionRepository } from '../infrastructure/repositories/PrismaSessionRepository';
import { PrismaAuthChallengeRepository } from '../infrastructure/repositories/PrismaAuthChallengeRepository';
import { PrismaUserRepository } from '../infrastructure/repositories/PrismaUserRepository';
import { communityQueryService } from '../queries/community/CommunityQueryService';

const communityApplicationService = new CommunityApplicationService(
  new PrismaCategoryRepository(),
  new PrismaPostRepository(),
  new PrismaCommentRepository(),
  new PrismaEngagementRepository()
);
import { PrismaRoleRepository } from '../infrastructure/repositories/PrismaRoleRepository';

const authApplicationService = new AuthApplicationService(
  new PrismaCaptchaChallengeRepository(),
  new PrismaPasskeyRepository(),
  new PrismaSessionRepository(),
  new PrismaAuthChallengeRepository(),
  new PrismaUserRepository(),
  new PrismaRoleRepository()
);
import { AppAbility } from '../lib/casl';
import { postLimiter } from '../lib/rateLimit';

const router: Router = Router();

router.get('/', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const posts = await communityQueryService.listPosts({
      ability: req.ability!,
      category: req.query.category as string,
      sortBy: req.query.sortBy as string,
    });
    res.json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_POSTS' });
  }
});

router.post('/', requireAuth, postLimiter, requireAbility('create', 'Post'), async (req: AuthRequest, res: Response): Promise<void> => {
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

    const isCaptchaValid = await authApplicationService.consumeCaptcha(captchaId);
    if (!isCaptchaValid) {
      res.status(400).json({ error: 'ERR_INVALID_OR_EXPIRED_CAPTCHA' });
      return;
    }

    const userLevel = await communityQueryService.getUserLevel(req.user!.userId);
    
    try {
      const result = await communityApplicationService.createPost(
        title, 
        content, 
        categoryId, 
        req.user!.userId, 
        userLevel
      );
      const postDto = await communityQueryService.getPostById(req.ability!, result.postId);
      res.status(201).json({ post: postDto, isModerated: result.isModerated });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
      return;
    }
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_CREATE_POST' });
  }
});

// Get post details
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    
    const post = await communityQueryService.getPostById(req.ability!, postId);

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
    const dto = await communityQueryService.getPostInteractions(req.ability!, req.params.id as string, req.user!.userId);
    if (!dto) {
      res.status(403).json({ error: 'ERR_POST_NOT_FOUND_OR_ACCESS_DENIED' });
      return;
    }
    res.json(dto);
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

    const post = await communityQueryService.getPostById(req.ability!, postId);

    if (!post) {
      res.status(403).json({ error: 'ERR_POST_NOT_FOUND_OR_ACCESS_DENIED' });
      return;
    }

    const status = await communityApplicationService.togglePostUpvote(postId, userId);
    res.json({ upvoted: status });
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

    const post = await communityQueryService.getPostById(req.ability!, postId);

    if (!post) {
      res.status(403).json({ error: 'ERR_POST_NOT_FOUND_OR_ACCESS_DENIED' });
      return;
    }

    const status = await communityApplicationService.togglePostBookmark(postId, userId);
    res.json({ bookmarked: status });
  } catch (error) {
    console.error('Error toggling bookmark:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_TOGGLE_BOOKMARK' });
  }
});

// GET comments for a post
router.get('/:id/comments', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const dto = await communityQueryService.listPostComments({
      ability: req.ability!,
      postId: req.params.id as string,
      ...(req.user?.userId ? { currentUserId: req.user.userId } : {}),
    });
    if (!dto) {
      res.status(403).json({ error: 'ERR_POST_NOT_FOUND_OR_ACCESS_DENIED' });
      return;
    }
    res.json(dto);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_COMMENTS' });
  }
});

// POST a comment to a post
router.post('/:id/comments', requireAuth, postLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
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

    const isCaptchaValid = await authApplicationService.consumeCaptcha(captchaId);
    if (!isCaptchaValid) {
      res.status(400).json({ error: 'ERR_INVALID_OR_EXPIRED_CAPTCHA' });
      return;
    }

    const post = await communityQueryService.getPostById(req.ability!, postId);

    if (!post) {
      res.status(403).json({ error: 'ERR_POST_NOT_FOUND_OR_ACCESS_DENIED' });
      return;
    }

    if (parentId) {
      const parentComment = await communityQueryService.getCommentById(parentId);
      if (!parentComment || parentComment.postId !== postId) {
        res.status(400).json({ error: 'ERR_INVALID_PARENT_COMMENT' });
        return;
      }
    }

    const result = await communityApplicationService.createComment(
      content,
      postId,
      req.user!.userId,
      parentId || undefined
    );

    const postObj = await communityQueryService.getPostBasicInfo(postId);
    if (postObj && postObj.authorId !== req.user!.userId) {
      globalEventBus.publish(new PostRepliedEvent(postId, postObj.authorId, postObj.title, req.user!.userId, result.commentId));
    }
    if (parentId) {
      const parentComment = await communityQueryService.getCommentBasicInfo(parentId);
      if (parentComment && parentComment.authorId !== req.user!.userId) {
        globalEventBus.publish(new CommentRepliedEvent(parentId, parentComment.authorId, postId, req.user!.userId, result.commentId));
      }
    }

    const commentDto = await communityQueryService.getCommentById(result.commentId);
    
    if (commentDto?.isPending) {
      res.status(201).json({ message: 'ERR_PENDING_MODERATION', comment: commentDto });
      return;
    }

    res.status(201).json(commentDto);
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

    const post = await communityQueryService.getPostWithCategory(postId);

    if (!post) {
      res.status(404).json({ error: 'ERR_POST_NOT_FOUND' });
      return;
    }

    // Instance-level authorization check
    if (!req.ability?.can('update', subject('Post', post as any))) {
      res.status(403).json({ error: 'ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_EDIT_THIS_POST' });
      return;
    }

    const result = await communityApplicationService.updatePost(postId, title, content, categoryId);
    const postDto = await communityQueryService.getPostById(req.ability!, result.postId);
    if (postDto?.status === 'PENDING') {
      res.json({ message: 'ERR_PENDING_MODERATION', post: postDto });
      return;
    }
    res.json(postDto);
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_UPDATE_POST' });
  }
});

router.delete('/:id', requireAuth, requireAbility('delete', 'Post'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    
    const post = await communityQueryService.getPostWithCategory(postId);

    if (!post) {
      res.status(404).json({ error: 'ERR_POST_NOT_FOUND' });
      return;
    }

    // Instance-level authorization check
    if (!req.ability?.can('delete', subject('Post', post as any))) {
      res.status(403).json({ error: 'ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_DELETE_THIS_POST' });
      return;
    }

    await communityApplicationService.deletePost(postId);
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

    const comment = await communityQueryService.getCommentWithPost(commentId);

    if (!comment) {
      res.status(404).json({ error: 'ERR_COMMENT_NOT_FOUND' });
      return;
    }

    // Instance-level authorization check
    if (!req.ability?.can('update', subject('Comment', comment as any))) {
      res.status(403).json({ error: 'ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_EDIT_THIS_COMMENT' });
      return;
    }

    
    const result = await communityApplicationService.updateComment(commentId, content, comment.post.categoryId);
    const commentDto = await communityQueryService.getCommentById(result.commentId);

    if (commentDto?.isPending) {
      res.json({ message: 'ERR_PENDING_MODERATION', comment: commentDto });
      return;
    }

    res.json(commentDto);
  } catch (error) {
    res.status(500).json({ error: 'ERR_FAILED_TO_UPDATE_COMMENT' });
  }
});

router.delete('/comments/:commentId', requireAuth, requireAbility('delete', 'Comment'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const commentId = req.params.commentId as string;
    
    const comment = await communityQueryService.getCommentWithPost(commentId);

    if (!comment) {
      res.status(404).json({ error: 'ERR_COMMENT_NOT_FOUND' });
      return;
    }

    // Instance-level authorization check
    if (!req.ability?.can('delete', subject('Comment', comment as any))) {
      res.status(403).json({ error: 'ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_DELETE_THIS_COMMENT' });
      return;
    }

    await communityApplicationService.deleteComment(commentId);
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

    const comment = await communityQueryService.getCommentWithPost(commentId);

    if (!comment) {
      res.status(404).json({ error: 'ERR_COMMENT_NOT_FOUND' });
      return;
    }

    // Verify user can read the post this comment belongs to
    if (!req.ability?.can('read', subject('Post', comment.post as any))) {
      res.status(403).json({ error: 'ERR_FORBIDDEN' });
      return;
    }

    const status = await communityApplicationService.toggleCommentUpvote(commentId, userId);
    res.json({ upvoted: status });
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

    const comment = await communityQueryService.getCommentWithPost(commentId);

    if (!comment) {
      res.status(404).json({ error: 'ERR_COMMENT_NOT_FOUND' });
      return;
    }

    // Verify user can read the post this comment belongs to
    if (!req.ability?.can('read', subject('Post', comment.post as any))) {
      res.status(403).json({ error: 'ERR_FORBIDDEN' });
      return;
    }

    const status = await communityApplicationService.toggleCommentBookmark(commentId, userId);
    res.json({ bookmarked: status });
  } catch (error) {
    console.error('Error toggling comment bookmark:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_TOGGLE_COMMENT_BOOKMARK' });
  }
});

export default router;

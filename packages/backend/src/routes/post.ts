/**
 * 路由模块：Post
 *
 * 函数作用：
 *   帖子和评论相关 API 路由，包括帖子 CRUD、评论 CRUD、点赞和书签。
 *   公开读取使用 optionalAuth，写操作需要认证和能力校验。
 *
 * Purpose:
 *   Post and comment API routes including CRUD operations, upvoting, and bookmarking.
 *   Public reads use optionalAuth; write operations require authentication and ability check.
 *
 * 路由前缀 / Route prefix:
 *   /api/posts
 *
 * 中间件 / Middleware:
 *   - optionalAuth（公开浏览）
 *   - requireAuth（写操作）
 *   - postLimiter（发帖频率限制）
 *   - requireAbility（权限校验）
 *
 * 中文关键词：
 *   帖子，评论，点赞，书签，CRUD
 * English keywords:
 *   post, comment, upvote, bookmark, CRUD
 */
import { NextFunction, Request, Response, Router } from 'express';
import { requireAuth, requireAbility, optionalAuth } from '../middleware/auth';
import { postLimiter, publicReadLimiter } from '../lib/rateLimit';
import { validate } from '../middleware/validation';
import {
  createCommentSchema,
  createPostSchema,
  updateCommentSchema,
  updatePostSchema,
} from '../lib/validation/schemas';

import {
  getPostsList,
  createPost,
  getPostDetails,
  getPostInteractions,
  toggleUpvote,
  toggleBookmark,
  getComments,
  createComment,
  updatePost,
  deletePost,
  updateComment,
  deleteComment,
  toggleCommentUpvote,
  toggleCommentBookmark
} from '../controllers/post';

const router: Router = Router();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuidParam(paramName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
      // UUID 形状不对时直接返回统一不存在，避免数据库暴露底层类型错误。
      res.status(404).json({ error: 'ERR_NOT_FOUND' });
      return;
    }
    next();
  };
}

// ── 帖子 ──
router.get('/', publicReadLimiter, optionalAuth, getPostsList);
router.post('/', requireAuth, postLimiter, requireAbility('create', 'Post'), validate(createPostSchema), createPost);

router.get('/:id', publicReadLimiter, requireUuidParam('id'), optionalAuth, getPostDetails);
router.get('/:id/interactions', requireUuidParam('id'), requireAuth, getPostInteractions);
router.post('/:id/upvote', requireUuidParam('id'), requireAuth, toggleUpvote);
router.post('/:id/bookmark', requireUuidParam('id'), requireAuth, toggleBookmark);

// ── 评论 ──
router.get('/:id/comments', publicReadLimiter, requireUuidParam('id'), optionalAuth, getComments);
router.post('/:id/comments', requireUuidParam('id'), requireAuth, postLimiter, validate(createCommentSchema), createComment);

// ── 帖子修改/删除 ──
router.put('/:id', requireUuidParam('id'), requireAuth, requireAbility('update', 'Post'), validate(updatePostSchema), updatePost);
router.delete('/:id', requireUuidParam('id'), requireAuth, requireAbility('delete', 'Post'), deletePost);

// ── 评论修改/删除 ──
router.put('/comments/:commentId', requireUuidParam('commentId'), requireAuth, requireAbility('update', 'Comment'), validate(updateCommentSchema), updateComment);
router.delete('/comments/:commentId', requireUuidParam('commentId'), requireAuth, requireAbility('delete', 'Comment'), deleteComment);
router.post('/comments/:commentId/upvote', requireUuidParam('commentId'), requireAuth, toggleCommentUpvote);
router.post('/comments/:commentId/bookmark', requireUuidParam('commentId'), requireAuth, toggleCommentBookmark);

export default router;

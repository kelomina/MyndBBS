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
import { Router } from 'express';
import { requireAuth, requireAbility, optionalAuth } from '../middleware/auth';
import { postLimiter } from '../lib/rateLimit';

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

// ── 帖子 ──
router.get('/', optionalAuth, getPostsList);
router.post('/', requireAuth, postLimiter, requireAbility('create', 'Post'), createPost);

router.get('/:id', optionalAuth, getPostDetails);
router.get('/:id/interactions', requireAuth, getPostInteractions);
router.post('/:id/upvote', requireAuth, toggleUpvote);
router.post('/:id/bookmark', requireAuth, toggleBookmark);

// ── 评论 ──
router.get('/:id/comments', optionalAuth, getComments);
router.post('/:id/comments', requireAuth, postLimiter, createComment);

// ── 帖子修改/删除 ──
router.put('/:id', requireAuth, requireAbility('update', 'Post'), updatePost);
router.delete('/:id', requireAuth, requireAbility('delete', 'Post'), deletePost);

// ── 评论修改/删除 ──
router.put('/comments/:commentId', requireAuth, requireAbility('update', 'Comment'), updateComment);
router.delete('/comments/:commentId', requireAuth, requireAbility('delete', 'Comment'), deleteComment);
router.post('/comments/:commentId/upvote', requireAuth, toggleCommentUpvote);
router.post('/comments/:commentId/bookmark', requireAuth, toggleCommentBookmark);

export default router;

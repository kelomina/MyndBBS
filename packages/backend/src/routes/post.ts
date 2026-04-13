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

router.get('/', optionalAuth, getPostsList);
router.post('/', requireAuth, postLimiter, requireAbility('create', 'Post'), createPost);

router.get('/:id', optionalAuth, getPostDetails);
router.get('/:id/interactions', requireAuth, getPostInteractions);
router.post('/:id/upvote', requireAuth, toggleUpvote);
router.post('/:id/bookmark', requireAuth, toggleBookmark);

router.get('/:id/comments', optionalAuth, getComments);
router.post('/:id/comments', requireAuth, postLimiter, createComment);

router.put('/:id', requireAuth, requireAbility('update', 'Post'), updatePost);
router.delete('/:id', requireAuth, requireAbility('delete', 'Post'), deletePost);

router.put('/comments/:commentId', requireAuth, requireAbility('update', 'Comment'), updateComment);
router.delete('/comments/:commentId', requireAuth, requireAbility('delete', 'Comment'), deleteComment);
router.post('/comments/:commentId/upvote', requireAuth, toggleCommentUpvote);
router.post('/comments/:commentId/bookmark', requireAuth, toggleCommentBookmark);

export default router;

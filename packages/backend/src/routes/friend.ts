/**
 * 路由模块：Friend
 *
 * 函数作用：
 *   好友管理 API 路由，包括好友请求、好友列表、删除好友和拉黑。
 *   所有路由要求认证。
 *
 * Purpose:
 *   Friend management API routes including friend requests, friend list,
 *   unfriending, and blocking. All routes require authentication.
 *
 * 路由前缀 / Route prefix:
 *   /api/v1/friends
 *
 * 中间件 / Middleware:
 *   - requireAuth（全部路由）
 *   - friendRequestLimiter（好友请求频率限制）
 *
 * 中文关键词：
 *   好友，好友请求，拉黑，列表
 * English keywords:
 *   friend, friend request, block, list
 */
import express from 'express';
import { requireAuth } from '../middleware/auth';
import { friendRequestLimiter } from '../lib/rateLimit';
import { requestFriend, respondFriend, getFriends, removeFriend, blockUser } from '../controllers/friend';

const router: express.Router = express.Router();

router.post('/request', requireAuth, friendRequestLimiter, requestFriend);
router.put('/respond', requireAuth, respondFriend);
router.get('/', requireAuth, getFriends);
router.delete('/remove', requireAuth, removeFriend);
router.post('/block', requireAuth, blockUser);

export default router;

/**
 * 路由模块：Message
 *
 * 函数作用：
 *   私信系统 API 路由，包括密钥管理、消息收发、收件箱、会话设置。
 *   所有路由要求认证。
 *
 * Purpose:
 *   Private messaging API routes including key management, message sending/receiving,
 *   inbox, and conversation settings. All routes require authentication.
 *
 * 路由前缀 / Route prefix:
 *   /api/v1/messages
 *
 * 中间件 / Middleware:
 *   - requireAuthHidden（全部路由，未认证时统一 404）
 *   - messageLimiter（消息发送频率限制）
 *
 * 中文关键词：
 *   私信，密钥，收件箱，会话设置，加密
 * English keywords:
 *   private message, key, inbox, conversation settings, encryption
 */
import express from 'express';
import { requireAuthHidden } from '../middleware/auth';
import { uploadKeys, getMyKey, getUserPublicKey, sendMessage, getInbox, getUnreadCount, markAsRead, deleteMessage, clearChat, getConversationSettings, updateConversationSettings } from '../controllers/message';
import { rateLimit } from 'express-rate-limit';
import { getClientIp } from '../lib/rateLimit';
import { validate } from '../middleware/validation';
import {
  conversationSettingsSchema,
  markMessageReadSchema,
  sendMessageSchema,
  uploadMessageKeysSchema,
} from '../lib/validation/schemas';

/**
 * 私信发送频率限制：每 2 秒最多 1 条
 */
const messageLimiter = rateLimit({
  windowMs: 2 * 1000,
  max: 1,
  keyGenerator: (req: any) => req.user?.userId || getClientIp(req),
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'ERR_MESSAGE_RATE_LIMIT_EXCEEDED' }
});

const router: express.Router = express.Router();

// ── 密钥管理 ──
router.post('/keys', requireAuthHidden, validate(uploadMessageKeysSchema), uploadKeys);
router.get('/keys/me', requireAuthHidden, getMyKey);
router.get('/keys/:username', requireAuthHidden, getUserPublicKey);

// ── 消息收发 ──
router.post('/', requireAuthHidden, messageLimiter, validate(sendMessageSchema), sendMessage);
router.get('/inbox', requireAuthHidden, getInbox);

// ── 未读/已读 ──
router.get('/unread', requireAuthHidden, getUnreadCount);
router.put('/read', requireAuthHidden, validate(markMessageReadSchema), markAsRead);

// ── 会话设置 ──
router.get('/settings/:partnerId', requireAuthHidden, getConversationSettings);
router.put('/settings/:partnerId', requireAuthHidden, validate(conversationSettingsSchema), updateConversationSettings);

// ── 删除 ──
router.delete('/chat/:withUserId', requireAuthHidden, clearChat);
router.delete('/:id', requireAuthHidden, deleteMessage);

export default router;

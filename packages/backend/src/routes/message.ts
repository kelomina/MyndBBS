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
 *   - requireAuth（全部路由）
 *   - messageLimiter（消息发送频率限制）
 *
 * 中文关键词：
 *   私信，密钥，收件箱，会话设置，加密
 * English keywords:
 *   private message, key, inbox, conversation settings, encryption
 */
import express from 'express';
import { requireAuth } from '../middleware/auth';
import { uploadKeys, getMyKey, getUserPublicKey, sendMessage, getInbox, getUnreadCount, markAsRead, deleteMessage, clearChat, getConversationSettings, updateConversationSettings } from '../controllers/message';
import { rateLimit } from 'express-rate-limit';

const getClientIp = (req: any, res: any): string => {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const headerValue = typeof xForwardedFor === 'string' ? xForwardedFor : xForwardedFor[0];
    if (headerValue) {
      const ips = headerValue.split(',').map((ip: string) => ip.trim());
      if (ips.length > 0 && ips[0]) {
        return ips[0];
      }
    }
  }
  return req.socket.remoteAddress || req.ip || 'unknown';
};

/**
 * 私信发送频率限制：每 2 秒最多 1 条
 */
const messageLimiter = rateLimit({
  windowMs: 2 * 1000,
  max: 1,
  keyGenerator: (req: any, res: any) => req.user?.userId || getClientIp(req, res),
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'ERR_MESSAGE_RATE_LIMIT_EXCEEDED' }
});

const router: express.Router = express.Router();

// ── 密钥管理 ──
router.post('/keys', requireAuth, uploadKeys);
router.get('/keys/me', requireAuth, getMyKey);
router.get('/keys/:username', requireAuth, getUserPublicKey);

// ── 消息收发 ──
router.post('/', requireAuth, messageLimiter, sendMessage);
router.get('/inbox', requireAuth, getInbox);

// ── 未读/已读 ──
router.get('/unread', requireAuth, getUnreadCount);
router.put('/read', requireAuth, markAsRead);

// ── 会话设置 ──
router.get('/settings/:partnerId', requireAuth, getConversationSettings);
router.put('/settings/:partnerId', requireAuth, updateConversationSettings);

// ── 删除 ──
router.delete('/:id', requireAuth, deleteMessage);
router.delete('/chat/:withUserId', requireAuth, clearChat);

export default router;
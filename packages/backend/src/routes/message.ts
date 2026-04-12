import express from 'express';
import { requireAuth } from '../middleware/auth';
import { uploadKeys, getMyKey, getUserPublicKey, sendMessage, getInbox, getUnreadCount, markAsRead, deleteMessage, clearChat, getConversationSettings, updateConversationSettings } from '../controllers/message';
import { rateLimit } from 'express-rate-limit';

/**
 * Callers: []
 * Callees: [map, split, trim]
 * Description: Handles the get client ip logic for the application.
 * Keywords: getclientip, get, client, ip, auto-annotated
 */
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

const messageLimiter = rateLimit({
  windowMs: 2 * 1000,
  max: 1,
  keyGenerator: (req: any, res: any) => req.user?.userId || getClientIp(req, res),
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'ERR_MESSAGE_RATE_LIMIT_EXCEEDED' }
});

const router: express.Router = express.Router();
router.post('/keys', requireAuth, uploadKeys);
router.get('/keys/me', requireAuth, getMyKey);
router.get('/keys/:username', requireAuth, getUserPublicKey);
router.post('/', requireAuth, messageLimiter, sendMessage);
router.get('/inbox', requireAuth, getInbox);

router.get('/unread', requireAuth, getUnreadCount);
router.put('/read', requireAuth, markAsRead);
router.get('/settings/:partnerId', requireAuth, getConversationSettings);
router.put('/settings/:partnerId', requireAuth, updateConversationSettings);
router.delete('/:id', requireAuth, deleteMessage);
router.delete('/chat/:withUserId', requireAuth, clearChat);
export default router;
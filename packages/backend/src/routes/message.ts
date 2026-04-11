import express from 'express';
import { requireAuth } from '../middleware/auth';
import { uploadKeys, getMyKey, getUserPublicKey, sendMessage, getInbox, getUnreadCount, markAsRead } from '../controllers/message';

const router: express.Router = express.Router();
router.post('/keys', requireAuth, uploadKeys);
router.get('/keys/me', requireAuth, getMyKey);
router.get('/keys/:username', requireAuth, getUserPublicKey);
router.post('/', requireAuth, sendMessage);
router.get('/inbox', requireAuth, getInbox);
router.get('/unread', requireAuth, getUnreadCount);
router.put('/read', requireAuth, markAsRead);
export default router;
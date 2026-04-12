import express from 'express';
import { requireAuth } from '../middleware/auth';
import { friendRequestLimiter } from '../lib/rateLimit';
import { requestFriend, respondFriend, getFriends } from '../controllers/friend';

const router: express.Router = express.Router();
router.post('/request', requireAuth, friendRequestLimiter, requestFriend);
router.put('/respond', requireAuth, respondFriend);
router.get('/', requireAuth, getFriends);
export default router;

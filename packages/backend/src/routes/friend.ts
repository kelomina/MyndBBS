import express from 'express';
import { requireAuth } from '../middleware/auth';
import { requestFriend, respondFriend, getFriends } from '../controllers/friend';

const router: express.Router = express.Router();
router.post('/request', requireAuth, requestFriend);
router.put('/respond', requireAuth, respondFriend);
router.get('/', requireAuth, getFriends);
export default router;

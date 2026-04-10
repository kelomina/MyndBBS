import express from 'express';
import { requireAuth } from '../middleware/auth';
import { getNotifications, markAsRead } from '../controllers/notification';

const router: express.Router = express.Router();
router.get('/', requireAuth, getNotifications);
router.post('/read', requireAuth, markAsRead);
export default router;
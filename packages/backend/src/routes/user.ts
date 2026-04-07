import { Router, Router as ExpressRouter } from 'express';
import { updateProfile, getSessions, revokeSession } from '../controllers/user';
import { requireAuth } from '../middleware/auth';

const router: ExpressRouter = Router();

// All user routes require authentication
router.use(requireAuth);

// Profile Management
router.put('/profile', updateProfile);

// Session Management
router.get('/sessions', getSessions);
router.delete('/sessions/:sessionId', revokeSession);

export default router;

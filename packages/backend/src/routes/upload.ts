import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { uploadLimiter } from '../lib/rateLimit';
import { uploadMiddleware, handleFileUpload } from '../controllers/upload';

const router: Router = Router();

router.post('/', requireAuth, uploadLimiter, uploadMiddleware.single('file'), handleFileUpload);

export default router;

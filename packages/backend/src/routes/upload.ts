import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { uploadLimiter } from '../lib/rateLimit';
import { handleFileUpload } from '../controllers/upload';

const router: Router = Router();
const uploadMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/', requireAuth, uploadLimiter, uploadMiddleware.single('file'), handleFileUpload);

export default router;

import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/auth';

const router: express.Router = express.Router();

const uploadDir = path.join(process.cwd(), 'uploads', 'messages');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  /**
   * Callers: []
   * Callees: [cb]
   * Description: An anonymous callback to determine the upload destination directory.
   * Keywords: upload, destination, multer, anonymous
   */
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => cb(null, uploadDir),
  /**
   * Callers: []
   * Callees: [now, round, random, cb]
   * Description: An anonymous callback to generate a unique filename for uploaded files.
   * Keywords: upload, filename, generate, multer, anonymous
   */
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '.enc');
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

/**
 * Callers: []
 * Callees: [status, json]
 * Description: An anonymous route handler that processes file uploads.
 * Keywords: upload, file, message, post, anonymous
 */
router.post('/', requireAuth, upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'ERR_NO_FILE' });
    return;
  }
  res.json({ url: `/uploads/messages/${req.file.filename}` });
});

export default router;

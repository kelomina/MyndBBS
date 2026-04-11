import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

const uploadDir = path.join(process.cwd(), 'uploads', 'messages');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '.enc');
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

router.post('/', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'ERR_NO_FILE' });
    return;
  }
  res.json({ url: `/uploads/messages/${req.file.filename}` });
});

export default router;

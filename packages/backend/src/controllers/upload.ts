/**
 * Upload Controller
 * Handles file uploads and multer configuration.
 */
import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

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

export const uploadMiddleware = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

/**
 * Callers: []
 * Callees: [status, json]
 * Description: Handles the successful upload of a file and returns its URL.
 * Keywords: upload, file, message, post
 */
export const handleFileUpload = (req: Request, res: Response): void => {
  if (!req.file) {
    res.status(400).json({ error: 'ERR_NO_FILE' });
    return;
  }
  res.json({ url: `/uploads/messages/${req.file.filename}` });
};

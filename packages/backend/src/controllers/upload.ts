/**
 * Upload Controller
 * Handles file uploads and multer configuration.
 */
import { Request, Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { systemApplicationService } from '../registry';

export const uploadMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * Callers: []
 * Callees: [status, json]
 * Description: Handles the successful upload of a file and returns its URL.
 * Keywords: upload, file, message, post
 */
export const handleFileUpload = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'ERR_NO_FILE' });
    return;
  }

  try {
    const filename = `${randomUUID()}.enc`;
    const url = await systemApplicationService.uploadAttachment(filename, req.file.buffer);
    res.json({ url });
  } catch (error: any) {
    if (error?.message?.startsWith('ERR_')) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'ERR_UPLOAD_FAILED' });
  }
};

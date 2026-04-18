/**
 * Upload Controller
 * Handles file uploads.
 */
import { Request, Response } from 'express';
import { systemApplicationService } from '../registry';

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
    const url = await systemApplicationService.uploadAttachment(req.file.buffer);
    res.json({ url });
  } catch (error: any) {
    if (error?.message?.startsWith('ERR_')) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'ERR_UPLOAD_FAILED' });
  }
};

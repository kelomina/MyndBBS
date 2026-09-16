/**
 * 路由模块：Upload
 *
 * 函数作用：
 *   文件上传 API 路由，支持图片上传，含 MIME 类型验证、扩展名过滤和魔数签名验证。
 *
 * 路由前缀 / Route prefix:
 *   /api/v1/messages/upload        — 私信图片（10MB）
 *   /api/v1/messages/upload/post-image — 帖子正文插图（10MB = 10485760 B，含边界，requireAuth）
 */
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { POST_ATTACHMENT_MAX_BYTES } from '@myndbbs/shared';
import { requireAuthHidden, requireAuth } from '../middleware/auth';
import { uploadLimiter } from '../lib/rateLimit';
import { handleFileUpload } from '../controllers/upload';
import { storagePort } from '../registry';
import type { AuthRequest } from '../middleware/auth';

const router: Router = Router();

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif'];

/**
 * Magic byte signatures for allowed image types.
 * Each entry maps a MIME type to one or more valid file header byte patterns.
 *
 * 各允许图片类型的文件头魔数签名，每个 MIME 类型对应一个或多个有效头部字节模式。
 */
const MAGIC_BYTES: Record<string, (number | null)[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50]],
  'image/bmp': [[0x42, 0x4D]],
  'image/tiff': [[0x49, 0x49, 0x2A, 0x00], [0x4D, 0x4D, 0x00, 0x2A]],
};

export function checkMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const signatures = MAGIC_BYTES[mimeType];
  if (!signatures) return false;

  return signatures.some(sig =>
    sig.every((byte, i) => byte === null || buffer[i] === byte)
  );
}

function validateMagicBytes(req: Request, res: Response, next: NextFunction): void {
  if (!req.file) {
    next();
    return;
  }

  const mimeType = req.file.mimetype;

  if (!checkMagicBytes(req.file.buffer, mimeType)) {
    res.status(400).json({ error: 'ERR_FILE_CONTENT_TYPE_MISMATCH' });
    return;
  }

  next();
}

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
  // Quick pre-check: MIME type and extension whitelist (client-provided, not trusted alone)
  if (ALLOWED_MIME_TYPES.includes(file.mimetype) && ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('ERR_FILE_TYPE_NOT_ALLOWED'));
  }
};

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});

// ── 帖子正文插图（10MB，认证用户）──
/**
 * 上限的 +1 是本文件唯一的收敛点（FREEZE R2），勿在他处重复此换算。
 * 原因（非直觉）：busboy@1.6.0 在累计文件字节「恰好等于」fileSizeLimit 时就 emit('limit')
 * （multipart.js:476-480），multer@2.2.0 无条件下抛 LIMIT_FILE_SIZE（make-middleware.js:219-221），
 * 故 limits.fileSize 的真实语义是「最大接受 N-1 字节」。要放行恰好 10485760 字节必须写 MAX + 1。
 * 超限响应体冻结为 {"error":"LIMIT_FILE_SIZE"}，不带 message，不新增 httpErrors 分支（FREEZE R4）。
 */
const postImageMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: POST_ATTACHMENT_MAX_BYTES + 1 },
  fileFilter,
});

router.post(
  '/post-image',
  requireAuth,
  uploadLimiter,
  postImageMiddleware.single('file'),
  validateMagicBytes,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const file = req.file;
      if (!userId || !file) {
        res.status(400).json({ error: 'ERR_NO_FILE' });
        return;
      }
      const dotIndex = file.originalname.toLowerCase().lastIndexOf('.');
      // 扩展名必须小写归一后再交给适配器：fileFilter 用小写比对放行，适配器白名单是小写，
      // 原样切片会让 IMG_0001.JPG 这类文件在落盘阶段抛错（FREEZE R8 / M1）。
      const ext = dotIndex === -1 ? '' : file.originalname.slice(dotIndex + 1).toLowerCase();
      const url = await storagePort.savePostImage(userId, file.buffer, ext);
      res.status(201).json({ url });
    } catch (err) {
      // 由请求内容决定的失败（扩展名不被适配器接受等）一律 400 + 原始码，不得退化 500（FREEZE R8 / M2）；
      // 回落写法与 controllers/upload.ts 的既有分支保持一致。真故障（磁盘/权限）仍走 500。
      if (err instanceof Error && err.message.startsWith('ERR_')) {
        res.status(400).json({ error: err.message });
        return;
      }
      console.error('[upload] post image failed:', err);
      res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
    }
  }
);

router.post('/', requireAuthHidden, uploadMiddleware.single('file'), validateMagicBytes, handleFileUpload);

export default router;

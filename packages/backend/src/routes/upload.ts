/**
 * 路由模块：Upload
 *
 * 函数作用：
 *   文件上传 API 路由，支持图片上传，含 MIME 类型验证、扩展名过滤和魔数签名验证。
 * Purpose:
 *   File upload API route supporting image uploads with MIME type validation,
 *   extension filtering, and magic byte signature verification.
 *
 * 路由前缀 / Route prefix:
 *   /api/v1/messages/upload
 *
 * 安全注意 / Security:
 *   - 仅允许图片类型（MIME + 扩展名双重校验）
 *   - 魔数签名验证防止伪装文件
 *   - 文件大小限制 10MB
 *
 * 中文关键词：
 *   上传，文件，图片，安全验证，魔数
 * English keywords:
 *   upload, file, image, security validation, magic bytes
 */
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { uploadLimiter } from '../lib/rateLimit';
import { handleFileUpload } from '../controllers/upload';

const router: Router = Router();

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif'];

/**
 * Magic byte signatures for allowed image types.
 * Each entry maps a MIME type to one or more valid file header byte patterns.
 *
 * 各允许图片类型的文件头魔数签名，每个 MIME 类型对应一个或多个有效头部字节模式。
 *
 * Keywords: magic bytes, file signature, header, validate, upload, 魔数, 文件头, 签名, 验证, 上传
 */
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'image/bmp': [[0x42, 0x4D]],
  'image/tiff': [[0x49, 0x49, 0x2A, 0x00], [0x4D, 0x4D, 0x00, 0x2A]],
};

/**
 * Callers: [validateMagicBytes]
 * Callees: []
 * Description: Checks whether the first bytes of a buffer match one of the expected magic byte signatures for a given MIME type.
 * 描述：检查缓冲区头部字节是否匹配指定 MIME 类型的任一有效魔数签名。
 * Variables: `buffer` 表示文件内容缓冲区；`signatures` 表示该 MIME 类型对应的签名模式列表。
 * 变量：`buffer` 是文件内容缓冲区；`signatures` 是该文件类型对应的签名模式列表。
 * Integration: Use this helper after file reception to validate the actual file content against its claimed MIME type.
 * 接入方式：在文件接收完毕后调用，验证实际文件内容与声称的 MIME 类型是否匹配。
 * Error Handling: Returns `true` when content matches; `false` when buffer is too short or no signature matches.
 * 错误处理：内容匹配时返回 `true`，缓冲区过短或无签名匹配时返回 `false`。
 * Keywords: validate, magic bytes, signature, file header, upload security, 验证, 魔数, 签名, 文件头, 上传安全
 */
function checkMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const signatures = MAGIC_BYTES[mimeType];
  if (!signatures) return false;

  return signatures.some(sig =>
    sig.every((byte, i) => buffer[i] === byte)
  );
}

/**
 * Callers: [uploadMiddleware pipeline]
 * Callees: [checkMagicBytes]
 * Description: Validates that the uploaded file content matches its claimed MIME type via magic byte signature comparison.
 * 描述：通过魔数签名对比，验证上传文件的实际内容是否与声称的 MIME 类型匹配。
 * Variables: `file` 表示 multer 处理后的上传文件对象；`mimeType` 表示文件声称的 MIME 类型。
 * 变量：`file` 是 multer 处理后的上传文件对象；`mimeType` 是文件声称的 MIME 类型。
 * Integration: Call this middleware immediately after multer processes the file but before the controller handler.
 * 接入方式：在 multer 处理完文件之后、控制器处理器之前调用此中间件。
 * Error Handling: Returns `400` with `ERR_FILE_CONTENT_TYPE_MISMATCH` when magic bytes don't match the claimed MIME type.
 * 错误处理：魔数与声称的 MIME 类型不匹配时返回 400 错误 `ERR_FILE_CONTENT_TYPE_MISMATCH`。
 * Keywords: validate, magic bytes, middleware, content type, upload, 验证, 魔数, 中间件, 内容类型, 上传
 */
function validateMagicBytes(req: Request, res: Response, next: NextFunction): void {
  if (!req.file) {
    next();
    return;
  }

  const mimeType = req.file.mimetype;

  // SVG files are XML-based and don't have fixed magic bytes; skip binary check
  if (mimeType === 'image/svg+xml') {
    next();
    return;
  }

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

router.post('/', requireAuth, uploadLimiter, uploadMiddleware.single('file'), validateMagicBytes, handleFileUpload);

export default router;

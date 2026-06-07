/**
 * 路由模块：User
 *
 * 函数作用：
 *   用户相关 API 路由，包括个人资料、安全设置（Passkey/TOTP）、会话管理。
 *   公开资料路由使用 optionalAuth，其余需要认证。
 *
 * Purpose:
 *   User API routes for profile management, security settings (Passkey/TOTP),
 *   and session management. Public profile routes use optionalAuth;
 *   all others require authentication.
 *
 * 路由前缀 / Route prefix:
 *   /api/v1/user
 *
 * 中间件 / Middleware:
 *   - optionalAuth（公开资料）
 *   - requireAuth（其他路由）
 *   - requireSudo（敏感操作如删除 Passkey）
 *
 * 中文关键词：
 *   用户，个人资料，安全设置，会话管理，公开资料
 * English keywords:
 *   user, profile, security settings, session management, public profile
 */
import { Router, Router as ExpressRouter, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { updateProfile, getSessions, revokeSession, getProfile, getPasskeys, deletePasskey, disableTotp, generatePasskeyOptions, verifyPasskey, generateTotp, verifyTotp, getPublicProfile, getBookmarkedPosts, updateCookiePreferences, uploadAvatar, deleteAvatar } from '../controllers/user';
import { getSudoPasskeyOptions, verifySudo, checkSudo } from '../controllers/sudo';
import { requireSudo } from '../middleware/auth';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { uploadLimiter } from '../lib/rateLimit';

const router: ExpressRouter = Router();

const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const AVATAR_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const MAGIC_BYTES: Record<string, (number | null)[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50]],
};

function checkAvatarMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const signatures = MAGIC_BYTES[mimeType];
  if (!signatures) return false;
  return signatures.some(sig => sig.every((byte, i) => byte === null || buffer[i] === byte));
}

const avatarFileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
  if (AVATAR_MIME_TYPES.includes(file.mimetype) && AVATAR_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('ERR_FILE_TYPE_NOT_ALLOWED'));
  }
};

const avatarUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: avatarFileFilter,
});

function validateAvatarMagicBytes(req: Request, res: Response, next: NextFunction): void {
  if (!req.file) {
    next();
    return;
  }
  if (!checkAvatarMagicBytes(req.file.buffer, req.file.mimetype)) {
    res.status(400).json({ error: 'ERR_FILE_CONTENT_TYPE_MISMATCH' });
    return;
  }
  next();
}

// ── 公开路由 ──
router.get('/public/:username', optionalAuth, getPublicProfile);

// 其余路由要求认证
router.use(requireAuth);

// ── Sudo 模式 ──
router.get('/sudo/check', checkSudo);
router.get('/sudo/passkey-options', getSudoPasskeyOptions);
router.post('/sudo/verify', verifySudo);

// ── 个人资料 ──
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/cookie-preferences', updateCookiePreferences);

// ── 头像 ──
router.post('/avatar', uploadLimiter, avatarUploadMiddleware.single('avatar'), validateAvatarMagicBytes, uploadAvatar);
router.delete('/avatar', deleteAvatar);

// ── 书签 ──
router.get('/bookmarks', getBookmarkedPosts);

// ── 安全设置 ──
router.get('/passkeys', getPasskeys);
router.delete('/passkeys/:id', requireSudo, deletePasskey);
router.get('/passkey/generate-registration-options', requireSudo, generatePasskeyOptions);
router.post('/passkey/verify-registration', requireSudo, verifyPasskey);

router.post('/totp/disable', requireSudo, disableTotp);
router.post('/totp/generate', requireSudo, generateTotp);
router.post('/totp/verify', requireSudo, verifyTotp);

// ── 会话管理 ──
router.get('/sessions', getSessions);
router.delete('/sessions/:sessionId', revokeSession);

export default router;

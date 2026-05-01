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
import { Router, Router as ExpressRouter } from 'express';
import { updateProfile, getSessions, revokeSession, getProfile, getPasskeys, deletePasskey, disableTotp, generatePasskeyOptions, verifyPasskey, generateTotp, verifyTotp, getPublicProfile, getBookmarkedPosts, updateCookiePreferences } from '../controllers/user';
import { getSudoPasskeyOptions, verifySudo, checkSudo } from '../controllers/sudo';
import { requireSudo } from '../middleware/auth';
import { requireAuth, optionalAuth } from '../middleware/auth';

const router: ExpressRouter = Router();

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

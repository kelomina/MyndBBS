/**
 * 路由模块：Auth
 *
 * 函数作用：
 *   认证相关 API 路由，包括注册、登录、注销、密码重置、验证码、TOTP 和 Passkey 双因素认证。
 *   各端点按敏感程度配置不同的频率限制。
 *
 * Purpose:
 *   Authentication API routes including registration, login, logout, password reset,
 *   captcha, TOTP and Passkey two-factor authentication.
 *   Each endpoint is rate-limited according to its sensitivity.
 *
 * 路由前缀 / Route prefix:
 *   /api/v1/auth
 *
 * 频率限制 / Rate limiting:
 *   - authLimiter: 通用 100次/15分钟
 *   - loginLimiter: 登录 10次/15分钟
 *   - registerLimiter: 注册 5次/小时
 *   - strict2FALimiter: 2FA 5次/15分钟
 *   - refreshLimiter: 刷新 10次/15分钟
 *
 * 中文关键词：
 *   认证，注册，登录，密码重置，双因素认证，验证码
 * English keywords:
 *   auth, registration, login, password reset, two-factor auth, captcha
 */
import { Router, Request } from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { 
  generateTotp, 
  verifyTotpRegistration, 
  generatePasskeyRegistrationOptions, 
  verifyPasskeyRegistrationResponse,
  verifyTotpLogin,
  generatePasskeyAuthenticationOptions,
  verifyPasskeyAuthenticationResponse,
  getAbility
} from '../controllers/auth';
import {
  registerUser,
  resendEmailRegistration,
  verifyEmailRegistration,
  requestPasswordReset,
  resetPasswordWithToken,
  loginUser,
  refreshToken,
  logoutUser
} from '../controllers/register';
import { generateCaptcha, verifyCaptcha } from '../controllers/captcha';
import { optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validation';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../lib/validation/schemas';

const router: Router = Router();

/**
 * 获取客户端真实 IP
 * 不使用 Express trust proxy 设置，直接解析 X-Forwarded-For 头部中首个 IP
 */
const getClientIp = (req: Request): string => {
  return ipKeyGenerator(req.ip || req.socket.remoteAddress || 'unknown');
};

// ── 频率限制器定义 ──

/** 通用认证频率限制：100次/15分钟 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'ERR_TOO_MANY_REQUESTS_FROM_THIS_IP_PLEASE_TRY_AGAIN_LATER' }
});

/** 登录频率限制：10次/15分钟，成功不计入 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'ERR_TOO_MANY_FAILED_LOGIN_ATTEMPTS_FROM_THIS_IP_PLEASE_TRY_AGAIN_LATER' }
});

/** 注册频率限制：5次/小时 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'ERR_TOO_MANY_REGISTRATION_ATTEMPTS_FROM_THIS_IP_PLEASE_TRY_AGAIN_LATER' }
});

/** 双因素认证限制：5次/15分钟，成功不计入 */
const strict2FALimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'ERR_TOO_MANY_FAILED_2FA_ATTEMPTS_FROM_THIS_IP_PLEASE_TRY_AGAIN_LATER' }
});

/** Token 刷新限制：10次/15分钟，成功不计入 */
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'ERR_TOO_MANY_REFRESH_ATTEMPTS_FROM_THIS_IP_PLEASE_TRY_AGAIN_LATER' }
});

router.use(authLimiter);

// ── 验证码 ──
router.get('/captcha', generateCaptcha);
router.post('/captcha/verify', verifyCaptcha);

// ── 注册 ──
router.post('/register', registerLimiter, validate(registerSchema), registerUser);
router.post('/register/resend-email', registerLimiter, resendEmailRegistration);
router.post('/register/verify-email', strict2FALimiter, validate(verifyEmailSchema), verifyEmailRegistration);

// ── 密码重置 ──
router.post('/password/forgot', registerLimiter, validate(forgotPasswordSchema), requestPasswordReset);
router.post('/password/reset', strict2FALimiter, validate(resetPasswordSchema), resetPasswordWithToken);

// ── 登录/注销 ──
router.post('/login', loginLimiter, validate(loginSchema), loginUser);
router.post('/logout', logoutUser);
router.post('/refresh', refreshLimiter, refreshToken);

// ── TOTP ──
router.post('/totp/generate', generateTotp);
router.post('/totp/verify', strict2FALimiter, verifyTotpRegistration);

// ── Passkey 注册 ──
router.get('/passkey/generate-registration-options', generatePasskeyRegistrationOptions);
router.post('/passkey/verify-registration', strict2FALimiter, verifyPasskeyRegistrationResponse);

// ── 双因素登录 ──
router.post('/totp/login-verify', strict2FALimiter, verifyTotpLogin);
router.get('/passkey/generate-authentication-options', generatePasskeyAuthenticationOptions);
router.post('/passkey/verify-authentication', strict2FALimiter, verifyPasskeyAuthenticationResponse);

// ── 权限查询 ──
router.get('/ability', optionalAuth, getAbility);

export default router;

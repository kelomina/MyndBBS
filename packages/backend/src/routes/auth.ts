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

// Utility to get the best possible IP address without relying on Express's trust proxy settings.
// In a typical proxy chain, the first IP added to X-Forwarded-For is the real client IP.
// Format: client, proxy1, proxy2...
const getClientIp = (req: Request): string => {
  return ipKeyGenerator(req.ip || req.socket.remoteAddress || 'unknown');
};

// Rate limiting for general auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false }, // Disable x-forwarded-for validation as we handle it manually
  message: { error: 'ERR_TOO_MANY_REQUESTS_FROM_THIS_IP_PLEASE_TRY_AGAIN_LATER' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Moderate limit for login
  skipSuccessfulRequests: true,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'ERR_TOO_MANY_FAILED_LOGIN_ATTEMPTS_FROM_THIS_IP_PLEASE_TRY_AGAIN_LATER' }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Strict limit for registration
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'ERR_TOO_MANY_REGISTRATION_ATTEMPTS_FROM_THIS_IP_PLEASE_TRY_AGAIN_LATER' }
});

const strict2FALimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Very strict limit for 2FA
  skipSuccessfulRequests: true,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'ERR_TOO_MANY_FAILED_2FA_ATTEMPTS_FROM_THIS_IP_PLEASE_TRY_AGAIN_LATER' }
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Moderate limit for refresh
  skipSuccessfulRequests: true,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'ERR_TOO_MANY_REFRESH_ATTEMPTS_FROM_THIS_IP_PLEASE_TRY_AGAIN_LATER' }
});

router.use(authLimiter);

// Captcha
router.get('/captcha', generateCaptcha);
router.post('/captcha/verify', verifyCaptcha);

// Auth
router.post('/register', registerLimiter, validate(registerSchema), registerUser);
router.post('/register/resend-email', registerLimiter, resendEmailRegistration);
router.post('/register/verify-email', strict2FALimiter, validate(verifyEmailSchema), verifyEmailRegistration);
router.post('/password/forgot', registerLimiter, validate(forgotPasswordSchema), requestPasswordReset);
router.post('/password/reset', strict2FALimiter, validate(resetPasswordSchema), resetPasswordWithToken);
router.post('/login', loginLimiter, validate(loginSchema), loginUser);
router.post('/logout', logoutUser);
router.post('/refresh', refreshLimiter, refreshToken);
router.post('/totp/generate', generateTotp);
router.post('/totp/verify', strict2FALimiter, verifyTotpRegistration);
router.get('/passkey/generate-registration-options', generatePasskeyRegistrationOptions);
router.post('/passkey/verify-registration', strict2FALimiter, verifyPasskeyRegistrationResponse);

// 2FA Login
router.post('/totp/login-verify', strict2FALimiter, verifyTotpLogin);
router.get('/passkey/generate-authentication-options', generatePasskeyAuthenticationOptions);
router.post('/passkey/verify-authentication', strict2FALimiter, verifyPasskeyAuthenticationResponse);

router.get('/ability', optionalAuth, getAbility);

export default router;

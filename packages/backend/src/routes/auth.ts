import { Router, Request } from 'express';
import rateLimit from 'express-rate-limit';
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
import { registerUser, loginUser, refreshToken, logoutUser } from '../controllers/register';
import { generateCaptcha, verifyCaptcha } from '../controllers/captcha';
import { optionalAuth } from '../middleware/auth';

const router: Router = Router();

// Utility to get the best possible IP address without relying on Express's trust proxy settings.
// In a typical proxy chain, the first IP added to X-Forwarded-For is the real client IP.
// Format: client, proxy1, proxy2...
const getClientIp = (req: Request): string => {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const ips = (typeof xForwardedFor === 'string' ? xForwardedFor : xForwardedFor[0]).split(',').map(ip => ip.trim());
    // We take the FIRST IP in the chain, which represents the original client's IP.
    return ips[0];
  }
  return req.socket.remoteAddress || req.ip || 'unknown';
};

// Rate limiting for general auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  keyGenerator: getClientIp,
  validate: { xForwardedForHeader: false }, // Disable x-forwarded-for validation as we handle it manually
  message: { error: 'Too many requests from this IP, please try again later.' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Moderate limit for login
  skipSuccessfulRequests: true,
  keyGenerator: getClientIp,
  validate: { xForwardedForHeader: false },
  message: { error: 'Too many failed login attempts from this IP, please try again later.' }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Strict limit for registration
  keyGenerator: getClientIp,
  validate: { xForwardedForHeader: false },
  message: { error: 'Too many registration attempts from this IP, please try again later.' }
});

const strict2FALimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Very strict limit for 2FA
  skipSuccessfulRequests: true,
  keyGenerator: getClientIp,
  validate: { xForwardedForHeader: false },
  message: { error: 'Too many failed 2FA attempts from this IP, please try again later.' }
});

router.use(authLimiter);

// Captcha
router.get('/captcha', generateCaptcha);
router.post('/captcha/verify', verifyCaptcha);

// Auth
router.post('/register', registerLimiter, registerUser);
router.post('/login', loginLimiter, loginUser);
router.post('/logout', logoutUser);
router.post('/refresh', refreshToken); // Uses general authLimiter from router.use()
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

import { Router } from 'express';
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
import { registerUser, loginUser, refreshToken } from '../controllers/register';
import { generateCaptcha, verifyCaptcha } from '../controllers/captcha';
import { optionalAuth } from '../middleware/auth';

const router: Router = Router();

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  message: { error: 'Too many requests from this IP, please try again later.' }
});

const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per window
  skipSuccessfulRequests: true, // IMPORTANT: only count failed attempts to prevent blocking valid users
  message: { error: 'Too many failed attempts from this IP, please try again later.' }
});

router.use(authLimiter);

// Captcha
router.get('/captcha', generateCaptcha);
router.post('/captcha/verify', verifyCaptcha);

// Auth
router.post('/register', strictAuthLimiter, registerUser);
router.post('/login', strictAuthLimiter, loginUser);
router.post('/refresh', refreshToken); // Uses general authLimiter from router.use()
router.post('/totp/generate', generateTotp);
router.post('/totp/verify', verifyTotpRegistration);
router.get('/passkey/generate-registration-options', generatePasskeyRegistrationOptions);
router.post('/passkey/verify-registration', verifyPasskeyRegistrationResponse);

// 2FA Login
router.post('/totp/login-verify', verifyTotpLogin);
router.get('/passkey/generate-authentication-options', generatePasskeyAuthenticationOptions);
router.post('/passkey/verify-authentication', verifyPasskeyAuthenticationResponse);

router.get('/ability', optionalAuth, getAbility);

export default router;

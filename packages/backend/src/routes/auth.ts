import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { generateRegisterChallenge, verifyRegisterChallenge } from '../controllers/auth';
import { registerUser, loginUser, refreshToken } from '../controllers/register';
import { generateCaptcha, verifyCaptcha } from '../controllers/captcha';

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
router.post('/register/challenge', generateRegisterChallenge);
router.post('/register/challenge/verify', verifyRegisterChallenge);

export default router;

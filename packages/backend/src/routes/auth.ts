import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { generateRegisterChallenge } from '../controllers/auth';
import { registerUser, loginUser } from '../controllers/register';
import { generateCaptcha, verifyCaptcha } from '../controllers/captcha';

const router: Router = Router();

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  message: { error: 'Too many requests from this IP, please try again later.' }
});

router.use(authLimiter);

// Captcha
router.get('/captcha', generateCaptcha);
router.post('/captcha/verify', verifyCaptcha);

// Auth
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/register/challenge', generateRegisterChallenge);

export default router;

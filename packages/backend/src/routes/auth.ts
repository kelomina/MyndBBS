import { Router } from 'express';
import { generateRegisterChallenge } from '../controllers/auth';
import { registerUser } from '../controllers/register';
import { generateCaptcha, verifyCaptcha } from '../controllers/captcha';

const router: Router = Router();

// Captcha
router.get('/captcha', generateCaptcha);
router.post('/captcha/verify', verifyCaptcha);

// Auth
router.post('/register', registerUser);
router.post('/register/challenge', generateRegisterChallenge);

export default router;

import { Router } from 'express';
import { generateRegisterChallenge } from '../controllers/auth';
import { registerUser } from '../controllers/register';

const router: Router = Router();

router.post('/register', registerUser);
router.post('/register/challenge', generateRegisterChallenge);

export default router;

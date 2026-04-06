<<<<<<< HEAD
import { Router } from 'express';
import { generateRegisterChallenge } from '../controllers/auth';
import { registerUser } from '../controllers/register';

const router: Router = Router();

router.post('/register', registerUser);
router.post('/register/challenge', generateRegisterChallenge);

export default router;
=======
import { Router } from 'express';
import { generateRegisterChallenge } from '../controllers/auth';
import { registerUser } from '../controllers/register';

const router: Router = Router();

router.post('/register', registerUser);
router.post('/register/challenge', generateRegisterChallenge);

export default router;
>>>>>>> 1329c3fdb4867570945a53839bfd922bac2df958

import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
import { search } from '../controllers/search';

const router: Router = Router();

router.get('/', optionalAuth, search);

export default router;

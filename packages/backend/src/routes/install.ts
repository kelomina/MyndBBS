import { Router } from 'express';
import { getTailwindScript, getInstallHtml, setupEnv, setupAdmin } from '../controllers/install';

const router: Router = Router();

router.get('/tailwind.js', getTailwindScript);
router.get('/', getInstallHtml);
router.post('/api/env', setupEnv);
router.post('/api/admin', setupAdmin);

export default router;

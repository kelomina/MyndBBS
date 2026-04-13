import { Router } from 'express';
import { getCategoriesList } from '../controllers/category';

const router: Router = Router();

router.get('/', getCategoriesList);

export default router;

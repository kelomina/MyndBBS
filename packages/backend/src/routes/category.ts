import { Router, Response, Request } from 'express';
import { communityQueryService } from '../queries/community/CommunityQueryService';

const router: Router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const categories = await communityQueryService.listCategories();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_CATEGORIES' });
  }
});

export default router;

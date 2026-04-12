import { Router, Response, Request } from 'express';
import { prisma } from '../db';

const router: Router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      take: 1000,
      orderBy: { sortOrder: 'asc' }
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_CATEGORIES' });
  }
});

export default router;

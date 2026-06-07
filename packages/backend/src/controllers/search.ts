import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SearchQueryService } from '../queries/search/SearchQueryService';

const searchQueryService = new SearchQueryService();

/**
 * Callers: [searchRouter]
 * Callees: [searchQueryService.search, json, status]
 * Description: Handles global search requests and returns matched posts and users.
 * Keywords: search, global, query, controller
 */
export const search = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = req.query.q as string;
    if (!q || q.trim() === '') {
      res.json({ posts: [], users: [] });
      return;
    }

    const results = await searchQueryService.search(req.ability!, q.trim());
    res.json(results);
  } catch (error) {
    console.error('Error in search:', error);
    res.status(500).json({ error: 'ERR_SEARCH_FAILED' });
  }
};

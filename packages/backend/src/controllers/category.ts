/**
 * Community Category Controller
 * Handles incoming requests for reading category data.
 */
import { Request, Response } from 'express';
import { communityQueryService } from '../queries/community/CommunityQueryService';

/**
 * Callers: []
 * Callees: [communityQueryService.listCategories, json, status]
 * Description: Fetches all available categories via the query service.
 * Keywords: category, list, get, community, query
 */
export const getCategoriesList = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await communityQueryService.listCategories();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_CATEGORIES' });
  }
};

/**
 * 函数名称：getCategoriesList
 *
 * 函数作用：
 *   获取所有可见分类列表。
 * Purpose:
 *   Fetches the list of all visible categories.
 *
 * 调用方 / Called by:
 *   GET /api/categories
 *
 * 被调用方 / Calls:
 *   - communityQueryService.listCategories
 *
 * 参数说明 / Parameters:
 *   无
 *
 * 返回值说明 / Returns:
 *   200: Category[] 分类数组
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   500: ERR_FAILED_TO_FETCH_CATEGORIES
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   分类，列表，查询，公开
 * English keywords:
 *   category, list, query, public
 */
import { Request, Response } from 'express';
import { communityQueryService } from '../queries/community/CommunityQueryService';

export const getCategoriesList = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await communityQueryService.listCategories();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_CATEGORIES' });
  }
};

/**
 * 路由模块：Category
 *
 * 函数作用：
 *   公开分类列表 API 路由。
 * Purpose:
 *   Public category list API route.
 *
 * 路由前缀 / Route prefix:
 *   /api/categories
 *
 * 中文关键词：
 *   分类，列表，公开
 * English keywords:
 *   category, list, public
 */
import { Router } from 'express';
import { getCategoriesList } from '../controllers/category';

const router: Router = Router();

router.get('/', getCategoriesList);

export default router;

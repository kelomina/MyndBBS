/**
 * 路由模块：Search
 *
 * 函数作用：
 *   全局搜索 API 路由，支持帖子和用户搜索。
 * Purpose:
 *   Global search API route supporting post and user search.
 *
 * 路由前缀 / Route prefix:
 *   /api/search
 *
 * 中间件 / Middleware:
 *   - optionalAuth（可选认证）
 *
 * 中文关键词：
 *   搜索，帖子，用户，全局
 * English keywords:
 *   search, post, user, global
 */
import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
import { search } from '../controllers/search';

const router: Router = Router();

router.get('/', optionalAuth, search);

export default router;

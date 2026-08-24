/**
 * 路由模块：Tag（话题标签公开查询）
 *
 * 函数作用：
 *   GET /api/tags — 全部标签按帖子数降序（公开，限流）。
 *   按标签过滤帖子由 GET /api/posts?tag=<name> 提供。
 */
import { Router } from 'express';
import { publicReadLimiter } from '../lib/rateLimit';
import { tagRepository } from '../registry';

const router: Router = Router();

router.get('/', publicReadLimiter, async (_req, res) => {
  try {
    res.json({ tags: await tagRepository.listWithCounts() });
  } catch (err) {
    console.error('[tagRoutes] list failed:', err);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
});

export default router;

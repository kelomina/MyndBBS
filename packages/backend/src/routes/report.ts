/**
 * 路由模块：Report（用户举报）
 *
 * 函数作用：
 *   用户端举报 API。挂载于 /api/v1/reports（index.ts）。
 *   管理端处理端点位于 routes/admin.ts 的 /reports 前缀。
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { submitReport } from '../controllers/report';
import { createReportSchema } from '../lib/validation/schemas';
import { validate } from '../middleware/validation';
import { reportLimiter } from '../lib/rateLimit';

const router: Router = Router();

router.post(
  '/',
  requireAuth,
  reportLimiter,
  validate(createReportSchema),
  submitReport
);

export default router;

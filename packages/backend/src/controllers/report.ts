/**
 * 控制器模块：Report（用户举报）
 *
 * 函数作用：
 *   用户端提交举报 + 管理端举报队列查询与处理。
 */
import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { reportApplicationService } from '../registry';
import { reportQueryService } from '../queries/report/ReportQueryService';
import { ReportStatus, ReportTargetType } from '../domain/community/ReportEnums';

function sendBusinessError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith('ERR_')) {
    const status = message.includes('NOT_FOUND')
      ? 404
      : message.includes('ALREADY')
        ? 409
        : 400;
    res.status(status).json({ error: message });
    return;
  }
  console.error('[reportController] 500 error:', message);
  res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
}

/**
 * POST /api/v1/reports — 提交举报
 */
export const submitReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reporterId = req.user?.userId;
    if (!reporterId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }
    const id = await reportApplicationService.submitReport({
      reporterId,
      targetType: req.body.targetType as ReportTargetType,
      postId: req.body.postId,
      commentId: req.body.commentId ?? null,
      reason: req.body.reason,
      detail: req.body.detail ?? null,
    });
    res.status(201).json({ message: 'Report submitted', report: { id, status: 'PENDING' } });
  } catch (error) {
    sendBusinessError(res, error);
  }
};

/**
 * GET /api/admin/reports — 举报队列（分页）
 */
export const getReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = (req.query.status as ReportStatus | undefined) || undefined;
    const targetType = (req.query.targetType as ReportTargetType | undefined) || undefined;
    const skip = req.query.skip ? Number.parseInt(String(req.query.skip), 10) : 0;
    const take = req.query.take ? Number.parseInt(String(req.query.take), 10) : 20;

    if (status && !['PENDING', 'RESOLVED', 'DISMISSED'].includes(status)) {
      res.status(400).json({ error: 'ERR_BAD_REQUEST' });
      return;
    }

    res.json(await reportQueryService.listReports({ status, targetType, skip, take }));
  } catch (error) {
    sendBusinessError(res, error);
  }
};

/**
 * POST /api/admin/reports/:id/resolve — 标记成立（触发徽章评估）
 */
export const resolveReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const handlerId = req.user?.userId;
    if (!handlerId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }
    await reportApplicationService.resolveReport(handlerId, req.params.id as string, req.body.note ?? null);
    res.json({ message: 'Report resolved' });
  } catch (error) {
    sendBusinessError(res, error);
  }
};

/**
 * POST /api/admin/reports/:id/dismiss — 标记驳回
 */
export const dismissReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const handlerId = req.user?.userId;
    if (!handlerId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }
    await reportApplicationService.dismissReport(handlerId, req.params.id as string, req.body.note ?? null);
    res.json({ message: 'Report dismissed' });
  } catch (error) {
    sendBusinessError(res, error);
  }
};

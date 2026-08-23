/**
 * 控制器模块：Badge
 *
 * 函数作用：
 *   管理后台徽章功能的 HTTP 请求处理：
 *   - 徽章定义 CRUD（创建/更新/删除/列表，SYSTEM 徽章仅可启停）
 *   - 手动授予 / 撤销用户徽章
 *   - 持有人查询、手动触发自动评估
 *
 * Purpose:
 *   HTTP request handling for admin badge management.
 */
import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { badgeApplicationService } from '../registry';
import { badgeQueryService } from '../queries/badge/BadgeQueryService';

/**
 * 统一的 ERR_ 错误码 → HTTP 状态映射（与 admin 控制器约定一致）。
 */
function sendBusinessError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith('ERR_')) {
    const status = message.includes('NOT_FOUND') ? 404 : message.includes('FORBIDDEN') ? 403 : 400;
    res.status(status).json({ error: message });
    return;
  }
  console.error('[badgeController] 500 error:', message);
  res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
}

export const getBadges = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json(await badgeApplicationService.listBadges());
  } catch (error) {
    sendBusinessError(res, error);
  }
};

export const createBadge = async (req: Request, res: Response): Promise<void> => {
  try {
    const badge = await badgeApplicationService.createBadge({
      code: req.body.code,
      name: req.body.name,
      description: req.body.description ?? null,
      icon: req.body.icon ?? null,
      color: req.body.color ?? null,
      grantType: req.body.grantType,
      conditionJson: req.body.condition,
      isActive: req.body.isActive,
      sortOrder: req.body.sortOrder,
    });
    res.status(201).json({ message: 'Badge created', badge: { id: badge.id, code: badge.code } });
  } catch (error) {
    sendBusinessError(res, error);
  }
};

export const updateBadge = async (req: Request, res: Response): Promise<void> => {
  try {
    const badge = await badgeApplicationService.updateBadge(req.params.id as string, {
      name: req.body.name,
      description: req.body.description,
      icon: req.body.icon,
      color: req.body.color,
      grantType: req.body.grantType,
      conditionJson: req.body.condition,
      isActive: req.body.isActive,
      sortOrder: req.body.sortOrder,
    });
    res.json({ message: 'Badge updated', badge: { id: badge.id, isActive: badge.isActive } });
  } catch (error) {
    sendBusinessError(res, error);
  }
};

export const deleteBadge = async (req: Request, res: Response): Promise<void> => {
  try {
    await badgeApplicationService.deleteBadge(req.params.id as string);
    res.json({ message: 'Badge deleted' });
  } catch (error) {
    sendBusinessError(res, error);
  }
};

export const grantBadge = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const operatorId = req.user?.userId;
    if (!operatorId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }
    await badgeApplicationService.grantBadgeToUser(
      operatorId,
      req.params.id as string,
      req.body.userId,
      req.body.reason ?? null,
    );
    res.json({ message: 'Badge granted' });
  } catch (error) {
    sendBusinessError(res, error);
  }
};

export const revokeBadge = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const operatorId = req.user?.userId;
    if (!operatorId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }
    await badgeApplicationService.revokeBadgeFromUser(
      operatorId,
      req.params.id as string,
      req.params.userId as string,
    );
    res.json({ message: 'Badge revoked' });
  } catch (error) {
    sendBusinessError(res, error);
  }
};

export const listBadgeHolders = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = (req.query.q || req.query.query) as string | undefined;
    const holders = await badgeQueryService.listBadgeHolders(req.params.id as string, q);
    res.json(holders);
  } catch (error) {
    sendBusinessError(res, error);
  }
};

export const runBadgeEvaluation = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await badgeApplicationService.evaluateAndGrantAll();
    res.json({ message: 'Evaluation finished', ...result });
  } catch (error) {
    sendBusinessError(res, error);
  }
};

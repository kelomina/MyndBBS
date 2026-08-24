/**
 * 控制器模块：Protection（治理强化：IP 封禁 + 防灌水策略）
 *
 * 函数作用：
 *   管理端点（ADMIN+，requireAbility('manage','all') 守卫）：
 *   - IP 封禁列表/新增/解封
 *   - 防灌水策略读取/更新
 */
import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ipBanApplicationService, antiSpamService } from '../registry';

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
  console.error('[protectionController] 500 error:', message);
  res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
}

export const listIpBans = async (_req: Request, res: Response): Promise<void> => {
  try {
    const bans = await ipBanApplicationService.listBanned();
    res.json(
      bans.map((b) => ({
        id: b.id,
        ip: b.ip,
        scope: b.scope,
        reason: b.reason,
        createdAt: b.createdAt,
        expiresAt: b.expiresAt,
      })),
    );
  } catch (error) {
    sendBusinessError(res, error);
  }
};

export const createIpBan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const operatorId = req.user?.userId;
    if (!operatorId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }
    const ban = await ipBanApplicationService.banIp({
      ip: req.body.ip,
      scope: req.body.scope ?? 'ALL',
      reason: req.body.reason ?? null,
      operatorId,
      expiresInDays: req.body.expiresInDays ?? null,
    });
    res.status(201).json({ message: 'IP banned', ban: { id: ban.id, ip: ban.ip } });
  } catch (error) {
    sendBusinessError(res, error);
  }
};

export const deleteIpBan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await ipBanApplicationService.unbanIp(req.params.id as string);
    res.json({ message: 'IP unbanned' });
  } catch (error) {
    sendBusinessError(res, error);
  }
};

export const getAntiSpamPolicy = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json(await antiSpamService.getPolicy());
  } catch (error) {
    sendBusinessError(res, error);
  }
};

export const updateAntiSpamPolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({
      message: 'Anti-spam policy updated',
      policy: await antiSpamService.updatePolicy(req.body),
    });
  } catch (error) {
    sendBusinessError(res, error);
  }
};

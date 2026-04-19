import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { systemQueryService } from '../queries/system/SystemQueryService';

export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Only SUPER_ADMIN can query audit logs
    if (req.user?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'ERR_FORBIDDEN_SUPER_ADMIN_ONLY' });
      return;
    }

    const skip = req.query.skip ? parseInt(req.query.skip as string, 10) : 0;
    const take = req.query.take ? parseInt(req.query.take as string, 10) : 50;
    const operatorId = req.query.operatorId as string | undefined;
    const operationType = req.query.operationType as string | undefined;

    const params: { skip?: number; take?: number; operatorId?: string; operationType?: string } = { skip, take };
    if (operatorId) params.operatorId = operatorId;
    if (operationType) params.operationType = operationType;

    const result = await systemQueryService.getAuditLogs(params);

    res.json(result);
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

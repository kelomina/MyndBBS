import { Request, Response } from 'express';
import { getAuditLogs } from '../../src/controllers/auditLog';
import { systemQueryService } from '../../src/queries/system/SystemQueryService';
import { AuthRequest } from '../../src/middleware/auth';

jest.mock('../../src/queries/system/SystemQueryService', () => ({
  systemQueryService: {
    getAuditLogs: jest.fn(),
  },
}));

describe('AuditLog Controller - getAuditLogs', () => {
  let req: Partial<AuthRequest>;
  let res: Partial<Response>;

  const createAbility = (canManageAll: boolean) => ({
    can: jest.fn().mockReturnValue(canManageAll),
    rules: [],
  });

  beforeEach(() => {
    req = {
      user: { userId: 'superadmin1', role: 'SUPER_ADMIN', sessionId: 'session1' },
      ability: createAbility(true) as any,
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('should return 403 if user is not SUPER_ADMIN', async () => {
    req.user!.role = 'ADMIN';
    req.ability = createAbility(false) as any;

    await getAuditLogs(req as AuthRequest, res as Response);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'ERR_FORBIDDEN_SUPER_ADMIN_ONLY' });
    expect(systemQueryService.getAuditLogs).not.toHaveBeenCalled();
  });

  it('should call getAuditLogs with default pagination if query is empty', async () => {
    const mockResult = { items: [], total: 0 };
    (systemQueryService.getAuditLogs as jest.Mock).mockResolvedValue(mockResult);

    await getAuditLogs(req as AuthRequest, res as Response);

    expect(systemQueryService.getAuditLogs).toHaveBeenCalledWith({ skip: 0, take: 50 });
    expect(res.json).toHaveBeenCalledWith(mockResult);
  });

  it('should parse query parameters correctly', async () => {
    const mockResult = { items: [{ id: '1', operationType: 'POST /test' }], total: 1 };
    (systemQueryService.getAuditLogs as jest.Mock).mockResolvedValue(mockResult);

    req.query = { skip: '10', take: '20', operatorId: 'u1', operationType: 'POST' };

    await getAuditLogs(req as AuthRequest, res as Response);

    expect(systemQueryService.getAuditLogs).toHaveBeenCalledWith({
      skip: 10,
      take: 20,
      operatorId: 'u1',
      operationType: 'POST'
    });
    expect(res.json).toHaveBeenCalledWith(mockResult);
  });

  it('should clamp take to the maximum page size', async () => {
    const mockResult = { items: [], total: 0 };
    (systemQueryService.getAuditLogs as jest.Mock).mockResolvedValue(mockResult);

    req.query = { take: '9999' };

    await getAuditLogs(req as AuthRequest, res as Response);

    expect(systemQueryService.getAuditLogs).toHaveBeenCalledWith({ skip: 0, take: 100 });
    expect(res.json).toHaveBeenCalledWith(mockResult);
  });

  it('should return 400 if pagination is invalid', async () => {
    req.query = { skip: 'abc' };

    await getAuditLogs(req as AuthRequest, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'ERR_BAD_REQUEST' });
    expect(systemQueryService.getAuditLogs).not.toHaveBeenCalled();
  });

  it('should return 500 if query service throws an error', async () => {
    (systemQueryService.getAuditLogs as jest.Mock).mockRejectedValue(new Error('DB Error'));

    await getAuditLogs(req as AuthRequest, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  });
});

import express from 'express';
import http from 'node:http';
import { UserStatus } from '@myndbbs/shared';
import adminRoutes from '../../src/routes/admin';
import { adminUserManagementApplicationService } from '../../src/registry';

let mockAuthRole = 'ADMIN';

jest.mock('../../src/registry', () => ({
  adminUserManagementApplicationService: {
    anonymizeUser: jest.fn(),
    createTestAccount: jest.fn(),
  },
}));

jest.mock('../../src/middleware/auth', () => ({
  requireAuthHidden: (req: any, _res: any, next: any) => {
    req.user = { userId: 'admin-1', role: mockAuthRole, sessionId: 'session-1' };
    req.ability = { can: () => true, rules: [] };
    next();
  },
  requireAbility: () => (_req: any, _res: any, next: any) => next(),
  requireSudo: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../src/controllers/auditLog', () => ({
  getAuditLogs: (_req: any, res: any) => res.status(200).json({ items: [] }),
}));

jest.mock('../../src/controllers/moderation', () => {
  const respond = (status = 200, body = { ok: true }) => (_req: any, res: any) => res.status(status).json(body);

  return {
    getModeratedWords: respond(),
    addModeratedWord: respond(201),
    deleteModeratedWord: respond(),
    getPendingPosts: respond(),
    approvePendingPost: respond(),
    rejectPendingPost: respond(),
    getPendingComments: respond(),
    approvePendingComment: respond(),
    rejectPendingComment: respond(),
  };
});

async function startServer(app: express.Express): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('ERR_TEST_SERVER_ADDRESS_UNAVAILABLE');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

describe('DELETE /api/admin/users/:id', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  async function deleteAdminUser(targetUserId = 'target-1'): Promise<Response> {
    mockAuthRole = 'ADMIN';

    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);

    const { baseUrl, close } = await startServer(app);
    try {
      return await fetch(`${baseUrl}/api/admin/users/${targetUserId}`, { method: 'DELETE' });
    } finally {
      await close();
    }
  }

  it('returns the anonymized user when deletion succeeds', async () => {
    (adminUserManagementApplicationService.anonymizeUser as jest.Mock).mockResolvedValue({
      id: 'target-1',
      username: 'deleted-user-target',
      email: 'deleted-target@deleted.local',
      status: UserStatus.INACTIVE,
    });

    const response = await deleteAdminUser();

    await expect(response.json()).resolves.toEqual({
      message: 'User deleted',
      user: {
        id: 'target-1',
        username: 'deleted-user-target',
        email: 'deleted-target@deleted.local',
        status: UserStatus.INACTIVE,
      },
    });
    expect(response.status).toBe(200);
    expect(adminUserManagementApplicationService.anonymizeUser).toHaveBeenCalledWith(
      { userId: 'admin-1', role: 'ADMIN' },
      'target-1',
    );
  });

  it('returns 404 when the target user does not exist', async () => {
    (adminUserManagementApplicationService.anonymizeUser as jest.Mock).mockRejectedValue(
      new Error('ERR_USER_NOT_FOUND'),
    );

    const response = await deleteAdminUser('missing-user');

    await expect(response.json()).resolves.toEqual({ error: 'ERR_USER_NOT_FOUND' });
    expect(response.status).toBe(404);
  });

  it('returns 403 when the operator cannot delete the target user', async () => {
    (adminUserManagementApplicationService.anonymizeUser as jest.Mock).mockRejectedValue(
      new Error('ERR_FORBIDDEN_CANNOT_DELETE_SELF'),
    );

    const response = await deleteAdminUser('admin-1');

    await expect(response.json()).resolves.toEqual({ error: 'ERR_FORBIDDEN_CANNOT_DELETE_SELF' });
    expect(response.status).toBe(403);
  });
});

describe('POST /api/admin/users/test-account', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  async function createAdminTestAccount(): Promise<Response> {
    mockAuthRole = 'SUPER_ADMIN';

    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);

    const { baseUrl, close } = await startServer(app);
    try {
      return await fetch(`${baseUrl}/api/admin/users/test-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'test_qa01',
          email: 'test_qa01@example.test',
          password: 'TestPass1!',
        }),
      });
    } finally {
      await close();
    }
  }

  it('returns the created test account when creation succeeds', async () => {
    (adminUserManagementApplicationService.createTestAccount as jest.Mock).mockResolvedValue({
      id: 'test-user-1',
      username: 'test_qa01',
      email: 'test_qa01@example.test',
      role: 'USER',
      status: UserStatus.ACTIVE,
      level: 1,
    });

    const response = await createAdminTestAccount();

    await expect(response.json()).resolves.toEqual({
      message: 'Test account created',
      user: {
        id: 'test-user-1',
        username: 'test_qa01',
        email: 'test_qa01@example.test',
        role: 'USER',
        status: UserStatus.ACTIVE,
        level: 1,
      },
    });
    expect(response.status).toBe(201);
    expect(adminUserManagementApplicationService.createTestAccount).toHaveBeenCalledWith(
      { userId: 'admin-1', role: 'SUPER_ADMIN' },
      {
        username: 'test_qa01',
        email: 'test_qa01@example.test',
        password: 'TestPass1!',
      },
    );
  });

  it('returns 400 when the test account identity already exists', async () => {
    (adminUserManagementApplicationService.createTestAccount as jest.Mock).mockRejectedValue(
      new Error('ERR_EMAIL_ALREADY_EXISTS'),
    );

    const response = await createAdminTestAccount();

    await expect(response.json()).resolves.toEqual({ error: 'ERR_EMAIL_ALREADY_EXISTS' });
    expect(response.status).toBe(400);
  });
});

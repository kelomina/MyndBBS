import express from 'express';
import http from 'node:http';
import { auditMiddleware } from '../../src/middleware/audit';
import adminRoutes from '../../src/routes/admin';
import { auditApplicationService } from '../../src/registry';

jest.mock('../../src/registry', () => ({
  auditApplicationService: {
    logAudit: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { userId: 'admin1', role: 'ADMIN', sessionId: 'session-1' };
    req.ability = { can: () => true, rules: [] };
    next();
  },
  requireAbility: () => (_req: any, _res: any, next: any) => next(),
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

jest.mock('../../src/controllers/admin', () => {
  const respond = (status = 200, body = { ok: true }) => (_req: any, res: any) => res.status(status).json(body);

  return {
    getUsers: respond(),
    updateUserRole: respond(),
    updateUserStatus: respond(),
    getCategories: respond(),
    createCategory: respond(201),
    updateCategory: respond(),
    deleteCategory: respond(),
    assignCategoryModerator: respond(),
    removeCategoryModerator: respond(),
    getPosts: respond(),
    updatePostStatus: respond(),
    getDeletedPosts: respond(),
    getDeletedComments: respond(),
    restorePost: respond(),
    hardDeletePost: respond(),
    restoreComment: respond(),
    hardDeleteComment: respond(),
    getDbConfig: respond(),
    updateDbConfig: respond(),
    getDomainConfig: respond(),
    updateDomainConfig: respond(),
    getRouteWhitelist: respond(200, { routes: [] }),
    addRouteWhitelist: respond(201, { ok: true }),
    updateRouteWhitelist: respond(),
    deleteRouteWhitelist: respond(),
    getEmailConfig: respond(),
    updateEmailConfig: respond(),
    updateEmailTemplate: respond(),
    sendTestEmail: respond(),
  };
});

/**
 * Callers: [adminAuditRouter.integration.test]
 * Callees: [createServer, listen, close]
 * Description: Starts an ephemeral HTTP server around the Express app so route-level audit behavior can be verified through real requests.
 * 描述：围绕 Express 应用启动一个临时 HTTP 服务，用真实请求验证路由级审计行为。
 * Variables: `app` 表示待启动的 Express 应用；`server` 表示临时 HTTP 服务；`address` 表示监听后的绑定地址。
 * 变量：`app` 表示待启动的 Express 应用；`server` 表示临时 HTTP 服务；`address` 表示监听后的绑定地址。
 * Integration: Use this helper inside integration tests that need actual `req.baseUrl` and `req.route.path` values from mounted routers.
 * 接入方式：在需要真实 `req.baseUrl` 和 `req.route.path` 的 integration 测试中调用本函数。
 * Error Handling: Throws when the test server address is unavailable so the caller fails fast instead of issuing malformed requests.
 * 错误处理：当测试服务地址不可用时直接抛错，避免调用方发出畸形请求。
 * Keywords: test server, express, integration, audit, route mount, 测试服务, Express, 集成测试, 审计, 路由挂载
 */
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

describe('adminRoutes + auditMiddleware integration', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('logs mounted routing-whitelist mutations through the fallback audit path', async () => {
    const app = express();
    app.use(express.json());
    app.use(auditMiddleware);
    app.use('/api/admin', adminRoutes);

    const { baseUrl, close } = await startServer(app);
    try {
      await fetch(`${baseUrl}/api/admin/routing-whitelist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'secretpassword', description: 'public route' }),
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(auditApplicationService.logAudit).toHaveBeenCalledTimes(1);
      expect(auditApplicationService.logAudit).toHaveBeenCalledWith(
        'admin1',
        'POST /api/admin/routing-whitelist',
        'Route: /api/admin/routing-whitelist',
        'ADMIN',
        '/api/admin/routing-whitelist',
        expect.any(String),
        expect.objectContaining({
          body: {
            password: '***',
            description: 'public route',
          },
          statusCode: 201,
        })
      );
    } finally {
      await close();
    }
  });

  it('skips mounted admin routes that are already audited by application services or domain events', async () => {
    const app = express();
    app.use(express.json());
    app.use(auditMiddleware);
    app.use('/api/admin', adminRoutes);

    const { baseUrl, close } = await startServer(app);
    try {
      await fetch(`${baseUrl}/api/admin/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'new-category' }),
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(auditApplicationService.logAudit).not.toHaveBeenCalled();
    } finally {
      await close();
    }
  });

  it('does not audit public whitelist reads mounted before auth', async () => {
    const app = express();
    app.use(express.json());
    app.use(auditMiddleware);
    app.use('/api/admin', adminRoutes);

    const { baseUrl, close } = await startServer(app);
    try {
      await fetch(`${baseUrl}/api/admin/routing-whitelist`, {
        method: 'GET',
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(auditApplicationService.logAudit).not.toHaveBeenCalled();
    } finally {
      await close();
    }
  });
});

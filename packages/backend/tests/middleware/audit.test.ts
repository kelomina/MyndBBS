import express from 'express';
import http from 'node:http';
import { auditMiddleware } from '../../src/middleware/audit';
import { auditApplicationService } from '../../src/registry';

jest.mock('../../src/registry', () => ({
  auditApplicationService: {
    logAudit: jest.fn().mockResolvedValue(undefined),
  },
}));

const startServer = async (app: express.Express): Promise<{ baseUrl: string; close: () => Promise<void> }> => {
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
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
};

describe('auditMiddleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should not log if user is not logged in', async () => {
    const app = express();
    app.use(express.json());
    app.use(auditMiddleware);
    app.post('/test', (req, res) => res.status(200).json({ ok: true }));

    const { baseUrl, close } = await startServer(app);
    try {
      await fetch(`${baseUrl}/test`, { method: 'POST' });
      // wait a bit for res.on('finish')
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(auditApplicationService.logAudit).not.toHaveBeenCalled();
    } finally {
      await close();
    }
  });

  it('should not log if user role is below MODERATOR', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      // @ts-ignore
      req.user = { userId: 'user1', role: 'USER' };
      next();
    });
    app.use(auditMiddleware);
    app.post('/test', (req, res) => res.status(200).json({ ok: true }));

    const { baseUrl, close } = await startServer(app);
    try {
      await fetch(`${baseUrl}/test`, { method: 'POST' });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(auditApplicationService.logAudit).not.toHaveBeenCalled();
    } finally {
      await close();
    }
  });

  it('should not log GET requests', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      // @ts-ignore
      req.user = { userId: 'admin1', role: 'ADMIN' };
      next();
    });
    app.use(auditMiddleware);
    app.get('/test', (req, res) => res.status(200).json({ ok: true }));

    const { baseUrl, close } = await startServer(app);
    try {
      await fetch(`${baseUrl}/test`, { method: 'GET' });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(auditApplicationService.logAudit).not.toHaveBeenCalled();
    } finally {
      await close();
    }
  });

  it('should log POST requests for ADMIN and mask passwords', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      // @ts-ignore
      req.user = { userId: 'admin1', role: 'ADMIN' };
      next();
    });
    app.use(auditMiddleware);
    app.post('/test', (req, res) => res.status(201).json({ ok: true }));

    const { baseUrl, close } = await startServer(app);
    try {
      await fetch(`${baseUrl}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'secretpassword', otherData: 'value' })
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      
      expect(auditApplicationService.logAudit).toHaveBeenCalledTimes(1);
      expect(auditApplicationService.logAudit).toHaveBeenCalledWith(
        'admin1',
        'POST /test',
        'Route: /test',
        'ADMIN',
        '/test',
        expect.any(String), // IP address
        expect.objectContaining({
          body: {
            password: '***',
            otherData: 'value'
          },
          statusCode: 201
        })
      );
    } finally {
      await close();
    }
  });
});

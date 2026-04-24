import express, { Request, Response } from 'express';
import http from 'node:http';
import authRoutes from '../../src/routes/auth';

type ServerHandle = {
  baseUrl: string;
  close: () => Promise<void>;
};

type JsonResponse = {
  status: number;
  body: Record<string, unknown>;
};

const mockControllerCallLog = {
  resendEmailRegistration: 0,
  requestPasswordReset: 0,
};

jest.mock('../../src/controllers/auth', () => {
  const respondOk = (_req: Request, res: Response): void => {
    res.status(200).json({ ok: true });
  };

  return {
    generateTotp: respondOk,
    verifyTotpRegistration: respondOk,
    generatePasskeyRegistrationOptions: respondOk,
    verifyPasskeyRegistrationResponse: respondOk,
    verifyTotpLogin: respondOk,
    generatePasskeyAuthenticationOptions: respondOk,
    verifyPasskeyAuthenticationResponse: respondOk,
    getAbility: respondOk,
  };
});

jest.mock('../../src/controllers/captcha', () => ({
  generateCaptcha: (_req: Request, res: Response): void => {
    res.status(200).json({ captchaId: 'captcha-1' });
  },
  verifyCaptcha: (_req: Request, res: Response): void => {
    res.status(200).json({ ok: true });
  },
}));

jest.mock('../../src/controllers/register', () => ({
  registerUser: (_req: Request, res: Response): void => {
    res.status(202).json({ ok: true });
  },
  resendEmailRegistration: (_req: Request, res: Response): void => {
    mockControllerCallLog.resendEmailRegistration += 1;
    res.status(202).json({ ok: true });
  },
  verifyEmailRegistration: (_req: Request, res: Response): void => {
    res.status(200).json({ ok: true });
  },
  requestPasswordReset: (_req: Request, res: Response): void => {
    mockControllerCallLog.requestPasswordReset += 1;
    res.status(202).json({ ok: true });
  },
  resetPasswordWithToken: (_req: Request, res: Response): void => {
    res.status(200).json({ ok: true });
  },
  loginUser: (_req: Request, res: Response): void => {
    res.status(200).json({ ok: true });
  },
  refreshToken: (_req: Request, res: Response): void => {
    res.status(200).json({ ok: true });
  },
  logoutUser: (_req: Request, res: Response): void => {
    res.status(200).json({ ok: true });
  },
}));

/**
 * Callers: [authEmailRateLimit.integration.test]
 * Callees: [express, express.json, authRoutes]
 * Description: Builds an isolated Express app that mounts the real auth router while mocked controllers keep the test focused on route-level rate limiting.
 * 描述：构建隔离的 Express 应用并挂载真实认证路由，控制器使用 mock，让测试聚焦在路由层限流行为。
 * Variables: `app` is the Express application under test; `trust proxy` lets tests assign a deterministic client IP through `X-Forwarded-For`.
 * 变量：`app` 表示待测 Express 应用；`trust proxy` 允许测试通过 `X-Forwarded-For` 指定稳定客户端 IP。
 * Integration: Use this helper before starting the ephemeral HTTP server in route integration tests.
 * 接入方式：在路由集成测试启动临时 HTTP 服务前调用本函数。
 * Error Handling: Express propagates route errors through the normal middleware stack; this helper does not catch them.
 * 错误处理：Express 会按常规中间件链传播路由错误，本函数不吞掉异常。
 * Keywords: express app, auth routes, rate limit, email abuse, integration, Express应用, 认证路由, 限流, 邮件滥用, 集成测试
 */
function buildAuthRouteApp(): express.Express {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  return app;
}

/**
 * Callers: [authEmailRateLimit.integration.test]
 * Callees: [http.createServer, server.listen, server.close]
 * Description: Starts an ephemeral HTTP server so Express rate-limit middleware observes real request metadata.
 * 描述：启动临时 HTTP 服务，让 Express 限流中间件读取真实请求元数据。
 * Variables: `app` is the mounted Express app; `server` is the temporary HTTP server; `address` is the bound listener address.
 * 变量：`app` 是已挂载路由的 Express 应用；`server` 是临时 HTTP 服务；`address` 是绑定后的监听地址。
 * Integration: Use this helper around fetch-based integration tests and always call `close` in a `finally` block.
 * 接入方式：在基于 fetch 的集成测试中使用，并始终在 `finally` 块中调用 `close`。
 * Error Handling: Throws when the bound address cannot be resolved, so tests fail before sending malformed requests.
 * 错误处理：当绑定地址无法解析时抛出异常，避免测试继续发送畸形请求。
 * Keywords: test server, HTTP, fetch, rate limit, integration, 测试服务, HTTP, 请求, 限流, 集成测试
 */
async function startServer(app: express.Express): Promise<ServerHandle> {
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

/**
 * Callers: [authEmailRateLimit.integration.test]
 * Callees: [fetch, Response.json]
 * Description: Sends a JSON POST request with a deterministic client IP so each rate-limit scenario is isolated.
 * 描述：发送带稳定客户端 IP 的 JSON POST 请求，让每个限流场景彼此隔离。
 * Variables: `baseUrl` is the temporary server origin; `path` is the auth route under test; `clientIp` is the synthetic caller identity; `body` is the JSON payload.
 * 变量：`baseUrl` 是临时服务地址；`path` 是待测认证路由；`clientIp` 是模拟调用方身份；`body` 是 JSON 请求体。
 * Integration: Use this helper when route tests need to assert status codes and JSON error payloads.
 * 接入方式：当路由测试需要断言状态码和 JSON 错误载荷时调用本函数。
 * Error Handling: Treats missing or invalid JSON response bodies as empty objects so status assertions remain clear.
 * 错误处理：响应体缺失或 JSON 无效时返回空对象，让状态码断言保持清晰。
 * Keywords: post json, forwarded ip, route test, response body, rate limit, JSON提交, 转发IP, 路由测试, 响应体, 限流
 */
async function postJson(
  baseUrl: string,
  path: string,
  clientIp: string,
  body: Record<string, string>
): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': clientIp,
    },
    body: JSON.stringify(body),
  });

  let parsedBody: Record<string, unknown> = {};
  try {
    parsedBody = (await response.json()) as Record<string, unknown>;
  } catch {
    parsedBody = {};
  }

  return {
    status: response.status,
    body: parsedBody,
  };
}

describe('auth email route rate limiting', () => {
  beforeEach(() => {
    mockControllerCallLog.resendEmailRegistration = 0;
    mockControllerCallLog.requestPasswordReset = 0;
  });

  it('limits registration verification email resend requests after five attempts', async () => {
    const { baseUrl, close } = await startServer(buildAuthRouteApp());
    const clientIp = '203.0.113.10';

    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await postJson(baseUrl, '/api/v1/auth/register/resend-email', clientIp, {
          email: 'pending@example.com',
        });
        expect(response.status).toBe(202);
      }

      const limitedResponse = await postJson(baseUrl, '/api/v1/auth/register/resend-email', clientIp, {
        email: 'pending@example.com',
      });

      expect(limitedResponse.status).toBe(429);
      expect(limitedResponse.body).toEqual({
        error: 'ERR_TOO_MANY_REGISTRATION_ATTEMPTS_FROM_THIS_IP_PLEASE_TRY_AGAIN_LATER',
      });
      expect(mockControllerCallLog.resendEmailRegistration).toBe(5);
    } finally {
      await close();
    }
  });

  it('limits forgot-password email requests after five attempts', async () => {
    const { baseUrl, close } = await startServer(buildAuthRouteApp());
    const clientIp = '203.0.113.11';

    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await postJson(baseUrl, '/api/v1/auth/password/forgot', clientIp, {
          email: 'user@example.com',
        });
        expect(response.status).toBe(202);
      }

      const limitedResponse = await postJson(baseUrl, '/api/v1/auth/password/forgot', clientIp, {
        email: 'user@example.com',
      });

      expect(limitedResponse.status).toBe(429);
      expect(limitedResponse.body).toEqual({
        error: 'ERR_TOO_MANY_REGISTRATION_ATTEMPTS_FROM_THIS_IP_PLEASE_TRY_AGAIN_LATER',
      });
      expect(mockControllerCallLog.requestPasswordReset).toBe(5);
    } finally {
      await close();
    }
  });
});

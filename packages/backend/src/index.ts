/**
 * 模块：Express 应用入口
 *
 * 函数作用：
 *   Express HTTP 服务器入口文件。根据 INSTALL_LOCKED 环境变量决定启动模式：
 *   - 未安装模式（false）：启动安装向导服务器
 *   - 正常模式（true）：启动生产/开发服务器
 * Purpose:
 *   Express HTTP server entry point. Determines startup mode based on INSTALL_LOCKED env var:
 *   - Install mode (false): starts the setup wizard server
 *   - Normal mode (true): starts the production/development server
 *
 * 中文关键词：
 *   Express，服务器，入口，安装，路由
 * English keywords:
 *   Express, server, entry, install, routes
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { i18next, i18nextMiddleware } from './i18n';
import { i18nErrorTranslationMiddleware } from './middleware/i18nErrorTranslation';

// 强制从后端目录加载 .env 文件，确保路径独立于 cwd
const envPath = path.resolve(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, '');
}
dotenv.config({ path: envPath });

const app = express();
app.disable('x-powered-by');
const port = process.env.PORT || 3001;

// ── 全局中间件 ──
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ limit: '100kb', extended: true }));
app.use(cookieParser());
app.use(i18nextMiddleware.handle(i18next));
app.use(i18nErrorTranslationMiddleware);

const isInstalled = process.env.INSTALL_LOCKED === 'true';

if (!isInstalled) {
  // ── 未安装模式：启动安装向导 ──
  const installModule = require('./routes/install');
  app.use('/install', installModule.default);
  
  /** 将非安装路径的请求重定向到安装页面 */
  app.use((req, res, next) => {
    if (req.path.startsWith('/install')) return next();
    res.redirect('/install');
  });

  /** 启动安装服务器 */
  app.listen(port, () => {
    console.log(`Setup server running. Please visit http://localhost:${port}/install to configure the system.`);
  });
} else {
  // ── 正常运行模式 ──
  /** 检验必要的 JWT 密钥配置 */
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET environment variables are not set. Please set them in your .env file or environment.');
  }

  if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different.');
  }

  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  } else {
    app.set('trust proxy', false);
  }

  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',');
  app.use(cors({ 
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('ERR_CORS_NOT_ALLOWED'));
      }
    }, 
    credentials: true 
  }));
  app.use(helmet());
  
  const { auditMiddleware } = require('./middleware/audit');
  app.use(auditMiddleware);

  /**
   * CSRF 防护中间件
   * 对 /api 下的非安全方法（POST/PUT/DELETE 等）：
   * - 校验 Origin 头在允许的域名列表中
   * - 校验 X-Requested-With 头为 XMLHttpRequest
   */
  app.use('/api', (req, res, next) => {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS', 'TRACE'];
    if (!safeMethods.includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && !allowedOrigins.includes(origin)) {
        return res.status(403).json({ error: 'ERR_CSRF_ORIGIN_MISMATCH' });
      }

      const requestedWith = req.headers['x-requested-with'];
      if (requestedWith !== 'XMLHttpRequest') {
        return res.status(403).json({ error: 'ERR_CSRF_TOKEN_MISSING_OR_INVALID' });
      }
    }
    next();
  });

  const { APP_NAME } = require('@myndbbs/shared');
  /** 健康检查端点 */
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: APP_NAME });
  });

  const authRoutes = require('./routes/auth').default;
  const publicRoutes = require('./routes/public').default;
  const userRoutes = require('./routes/user').default;
  const adminRoutes = require('./routes/admin').default;
  const postRoutes = require('./routes/post').default;
  const categoryRoutes = require('./routes/category').default;
  const messageRoutes = require('./routes/message').default;
  const uploadRoutes = require('./routes/upload').default;
  const friendRoutes = require('./routes/friend').default;
  const searchRoutes = require('./routes/search').default;
  
  // Initialize Domain Event Subscribers
  const { bootstrapDomainSubscribers } = require('./startup/bootstrapDomainSubscribers');
  bootstrapDomainSubscribers();

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/v1/user', userRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/v1/messages', messageRoutes);
  app.use('/api/v1/messages/upload', uploadRoutes);
  app.use('/api/v1/friends', friendRoutes);
  app.use('/api/search', searchRoutes);

  // Serve static files from uploads directory safely
  app.use('/uploads', (req, res, next) => {
    res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    next();
  }, express.static(require('path').join(process.cwd(), 'uploads')));

  /**
   * 全局错误处理中间件
   * 捕获所有未处理的异常，将 ERR_ 前缀错误码映射为对应 HTTP 状态码。
   */
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled Error:', err);
    const errorCode = typeof err?.message === 'string' && err.message.startsWith('ERR_')
      ? err.message
      : 'ERR_INTERNAL_SERVER_ERROR';

    const statusCode =
      errorCode.includes('UNAUTHORIZED') ? 401 :
      errorCode.includes('FORBIDDEN') ? 403 :
      errorCode.includes('NOT_FOUND') ? 404 :
      errorCode.includes('BAD_REQUEST') || errorCode.includes('INVALID') || errorCode.includes('MISSING') ? 400 :
      500;

    res.status(statusCode).json({ error: errorCode });
  });

  /** 启动主服务器 */
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

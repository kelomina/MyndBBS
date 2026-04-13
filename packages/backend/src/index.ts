import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Force load .env from the current backend directory explicitly, regardless of cwd
const envPath = path.resolve(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, '');
}
dotenv.config({ path: envPath });

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ limit: '100kb', extended: true }));
app.use(cookieParser());

const isInstalled = process.env.INSTALL_LOCKED === 'true';

if (!isInstalled) {
  // Install Mode
  const installModule = require('./routes/install');
  app.use('/install', installModule.default);
  
  /**
   * Callers: []
   * Callees: [startsWith, redirect]
   * Description: Handles redirecting all non-install requests to the installer when not installed.
   * Keywords: install, redirect, middleware, anonymous
   */
  app.use((req, res, next) => {
    if (req.path.startsWith('/install')) return next();
    res.redirect('/install');
  });

  /**
   * Callers: []
   * Callees: [log]
   * Description: Handles logging the setup server start event.
   * Keywords: install, listen, setup, server, anonymous
   */
  app.listen(port, () => {
    console.log(`Setup server running. Please visit http://localhost:${port}/install to configure the system.`);
  });
} else {
  // Normal Mode
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
        callback(new Error('Not allowed by CORS'));
      }
    }, 
    credentials: true 
  }));
  app.use(helmet());

  const { APP_NAME } = require('@myndbbs/shared');
  /**
   * Callers: []
   * Callees: [json]
   * Description: Handles health check requests.
   * Keywords: health, check, endpoint, anonymous
   */
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: APP_NAME });
  });

  const authRoutes = require('./routes/auth').default;
  const userRoutes = require('./routes/user').default;
  const adminRoutes = require('./routes/admin').default;
  const postRoutes = require('./routes/post').default;
  const categoryRoutes = require('./routes/category').default;
  const messageRoutes = require('./routes/message').default;
  const uploadRoutes = require('./routes/upload').default;
  const friendRoutes = require('./routes/friend').default;

  // Initialize Domain Event Subscribers
  const { NotificationApplicationService } = require('./application/notification/NotificationApplicationService');
  const { PrismaNotificationRepository } = require('./infrastructure/repositories/PrismaNotificationRepository');
  const { globalEventBus } = require('./infrastructure/events/InMemoryEventBus');
  new NotificationApplicationService(new PrismaNotificationRepository(), globalEventBus);

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/user', userRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/v1/messages', messageRoutes);
  app.use('/api/v1/messages/upload', uploadRoutes);
  app.use('/api/v1/friends', friendRoutes);

  // Serve static files from uploads directory
  app.use('/uploads', express.static(require('path').join(process.cwd(), 'uploads')));

  /**
   * Callers: []
   * Callees: [log]
   * Description: Handles logging the main server start event.
   * Keywords: listen, server, anonymous
   */
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

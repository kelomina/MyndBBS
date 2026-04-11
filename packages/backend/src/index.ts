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

app.use(express.json());
app.use(cookieParser());

const isInstalled = process.env.INSTALL_LOCKED === 'true';

if (!isInstalled) {
  // Install Mode
  const installModule = require('./routes/install');
  app.use('/install', installModule.default);
  
  // Redirect all other requests to the installer
  app.use((req, res, next) => {
    if (req.path.startsWith('/install')) return next();
    res.redirect('/install');
  });

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
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: APP_NAME });
  });

  const authRoutes = require('./routes/auth').default;
  const userRoutes = require('./routes/user').default;
  const adminRoutes = require('./routes/admin').default;
  const postRoutes = require('./routes/post').default;
  const categoryRoutes = require('./routes/category').default;
  const notificationRoutes = require('./routes/notification').default;
  const messageRoutes = require('./routes/message').default;

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/user', userRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/messages', messageRoutes);

  const { prisma } = require('./db');
  const crypto = require('crypto');
  const argon2 = require('argon2');

  const ensureSystemUser = async () => {
    const sysUser = await prisma.user.findUnique({ where: { username: 'system' } });
    if (!sysUser) {
      const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
      if (superAdminRole) {
        await prisma.user.create({
          data: {
            username: 'system',
            email: 'system@localhost',
            password: await argon2.hash(crypto.randomBytes(32).toString('hex')),
            status: 'ACTIVE',
            roleId: superAdminRole.id
          }
        });
        console.log('System user auto-initialized.');
      }
    }
  };

  ensureSystemUser().then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  }).catch((err: any) => console.error('Failed to ensure system user:', err));
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import path from 'path';

// Force load .env from the current backend directory explicitly, regardless of cwd
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { APP_NAME } from '@myndbbs/shared';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import userRoutes from './routes/user';
import postRoutes from './routes/post';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set. Please set it in your .env file or environment.');
}

const app = express();
const port = process.env.PORT || 3001;

// Trust the reverse proxy to ensure req.ip is correct for rate limiting
app.set('trust proxy', 1);

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: APP_NAME });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/posts', postRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

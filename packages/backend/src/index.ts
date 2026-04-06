import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { APP_NAME } from '@myndbbs/shared';
import authRoutes from './routes/auth';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: APP_NAME });
});

app.use('/api/v1/auth', authRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

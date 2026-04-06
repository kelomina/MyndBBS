import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET: string = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: missing token' });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = { userId: decoded.userId, role: decoded.role };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (req.user.role !== 'ADMIN' && req.user.role !== 'MODERATOR') {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
    return;
  }
  
  next();
};

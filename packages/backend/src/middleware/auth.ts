import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { redis } from '../lib/redis';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  let token = req.cookies?.accessToken;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: missing token' });
    return;
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    
    // Check session validity using Redis cache
    if (decoded.sessionId) {
      const cacheKey = `session:${decoded.sessionId}`;
      const cachedSession = await redis.get(cacheKey);

      if (cachedSession === 'invalid') {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.status(401).json({ error: 'Session revoked or invalid' });
        return;
      }

      if (!cachedSession) {
        const session = await prisma.session.findUnique({ where: { id: decoded.sessionId } });
        if (!session) {
          await redis.set(cacheKey, 'invalid', 'EX', 300); // Cache invalid state briefly
          res.clearCookie('accessToken');
          res.clearCookie('refreshToken');
          res.status(401).json({ error: 'Session revoked or invalid' });
          return;
        }
        await redis.set(cacheKey, 'valid', 'EX', 3600); // Cache valid session state
      }
    }
    
    req.user = { userId: decoded.userId, role: decoded.role };
    next();
  } catch (error) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
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

export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Forbidden: Super Admin access required' });
    return;
  }
  
  next();
};


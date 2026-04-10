import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, Session, UserStatus } from '@prisma/client';
import { prisma } from '../db';
import { redis } from '../lib/redis';
import { defineAbilityFor, AppAbility, Action, AppSubjects } from '../lib/casl';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
    sessionId: string;
  };
  ability?: AppAbility;
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
    res.status(401).json({ error: 'ERR_UNAUTHORIZED_MISSING_TOKEN' });
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
        res.status(401).json({ error: 'ERR_SESSION_REVOKED_OR_INVALID' });
        return;
      }

      if (!cachedSession) {
        const session = await prisma.session.findUnique({ where: { id: decoded.sessionId } });
        if (!session) {
          await redis.set(cacheKey, 'invalid', 'EX', 300); // Cache invalid state briefly
          res.clearCookie('accessToken');
          res.clearCookie('refreshToken');
          res.status(401).json({ error: 'ERR_SESSION_REVOKED_OR_INVALID' });
          return;
        }
        await redis.set(cacheKey, 'valid', 'EX', 3600); // Cache valid session state
      }

      const refreshKey = `${cacheKey}:requires_refresh`;
      const requiresRefresh = await redis.get(refreshKey);

      if (requiresRefresh === 'true') {
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          include: { role: true }
        });

        if (user && user.status !== UserStatus.BANNED) {
          const roleName = user.role?.name || 'USER';
          
          const newAccessToken = jwt.sign(
            { userId: user.id, role: roleName, sessionId: decoded.sessionId },
            process.env.JWT_SECRET as string,
            { expiresIn: '15m' }
          );

          decoded.role = roleName;
          
          res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000 // 15 minutes
          });

          // Instead of deleting immediately, keep it for 1 minute to allow
          // concurrent requests or SSR -> CSR transitions to also refresh
          await redis.expire(refreshKey, 60);
        } else if (user?.status === UserStatus.BANNED) {
          res.clearCookie('accessToken');
          res.clearCookie('refreshToken');
          res.status(401).json({ error: 'ERR_USER_BANNED' });
          return;
        }
      }
    }
    
    req.user = { userId: decoded.userId, role: decoded.role, sessionId: decoded.sessionId };

    let moderatedCategories: { categoryId: string }[] = [];
    if (decoded.role === 'MODERATOR') {
      moderatedCategories = await prisma.categoryModerator.findMany({
        where: { userId: decoded.userId },
        select: { categoryId: true }
      });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { level: true } });

    req.ability = defineAbilityFor({
      id: decoded.userId,
      role: decoded.role,
      level: dbUser?.level || 1,
      moderatedCategories
    });

    next();
  } catch (error) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.status(401).json({ error: 'ERR_INVALID_TOKEN' });
  }
};

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  let token = req.cookies?.accessToken;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    req.ability = defineAbilityFor(undefined);
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    req.user = { userId: decoded.userId, role: decoded.role, sessionId: decoded.sessionId };

    let moderatedCategories: { categoryId: string }[] = [];
    if (decoded.role === 'MODERATOR') {
      moderatedCategories = await prisma.categoryModerator.findMany({
        where: { userId: decoded.userId },
        select: { categoryId: true }
      });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { level: true } });

    req.ability = defineAbilityFor({
      id: decoded.userId,
      role: decoded.role,
      level: dbUser?.level || 1,
      moderatedCategories
    });
  } catch (error) {
    req.ability = defineAbilityFor(undefined);
  }
  next();
};

export const requireSudo = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user || !req.user.sessionId) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }
  const isSudo = await redis.get(`sudo:${req.user.sessionId}`);
  if (isSudo === 'true') {
    next();
  } else {
    res.status(403).json({ error: 'ERR_SUDO_REQUIRED', message: 'Re-authentication required for this action' });
  }
};

export const requireAbility = (action: Action, subject: AppSubjects) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.ability) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED_MISSING_ABILITY' });
      return;
    }

    if (req.ability.can(action, subject)) {
      next();
    } else {
      console.log('Forbidden! user:', req.user, 'rules:', req.ability.rules, 'action:', action, 'subject:', subject);
      res.status(403).json({ error: 'ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS' });
    }
  };
};


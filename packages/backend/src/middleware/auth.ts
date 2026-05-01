import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { defineAbilityForContext, AppAbility, Action, AppSubjects } from '../lib/casl';
import { accessControlQueryService } from '../queries/identity/AccessControlQueryService';
import { authApplicationService, authCache, sudoApplicationService } from '../registry';

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string, { algorithms: ['HS256'] }) as any;
    
    // Check session validity using Redis cache
    if (decoded.sessionId) {
      const cachedSession = await authCache.getSessionValidity(decoded.sessionId);

      if (cachedSession === 'invalid') {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.status(401).json({ error: 'ERR_SESSION_REVOKED_OR_INVALID' });
        return;
      }

      if (!cachedSession) {
        const { isValid } = await authApplicationService.validateSession(decoded.sessionId, decoded.userId);
        if (!isValid) {
          await authCache.setSessionValidity(decoded.sessionId, 'invalid', 300); // Cache invalid state briefly
          res.clearCookie('accessToken');
          res.clearCookie('refreshToken');
          res.status(401).json({ error: 'ERR_SESSION_REVOKED_OR_INVALID' });
          return;
        }
        await authCache.setSessionValidity(decoded.sessionId, 'valid', 3600); // Cache valid session state
      }

      const requiresRefresh = await authCache.checkRequiresRefresh(decoded.sessionId);

      if (requiresRefresh) {
        const { isValid, user, roleName, reason } = await authApplicationService.validateSession(decoded.sessionId, decoded.userId);

        if (isValid && user) {
          const newAccessToken = jwt.sign(
            { userId: user.id, role: roleName, sessionId: decoded.sessionId },
            process.env.JWT_SECRET as string,
            { expiresIn: '15m' }
          );

          decoded.role = roleName;
          
          res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000 // 15 minutes
          });

          // Instead of deleting immediately, keep it for 1 minute to allow
          // concurrent requests or SSR -> CSR transitions to also refresh
          await authCache.extendRefreshGracePeriod(decoded.sessionId, 60);
        } else if (reason === 'USER_BANNED') {
          res.clearCookie('accessToken');
          res.clearCookie('refreshToken');
          res.status(401).json({ error: 'ERR_USER_BANNED' });
          return;
        } else {
          res.clearCookie('accessToken');
          res.clearCookie('refreshToken');
          res.status(401).json({ error: 'ERR_SESSION_REVOKED_OR_INVALID' });
          return;
        }
      }
    }
    
    req.user = { userId: decoded.userId, role: decoded.role, sessionId: decoded.sessionId };

    const rulesDTO = await accessControlQueryService.getAbilityRulesForUser(decoded.userId);
    if (rulesDTO) {
      req.ability = defineAbilityForContext(rulesDTO.context, rulesDTO.rules);
    } else {
      req.ability = defineAbilityForContext();
    }

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
    req.ability = defineAbilityForContext();
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string, { algorithms: ['HS256'] }) as any;
    req.user = { userId: decoded.userId, role: decoded.role, sessionId: decoded.sessionId };

    const rulesDTO = await accessControlQueryService.getAbilityRulesForUser(decoded.userId);
    if (rulesDTO) {
      req.ability = defineAbilityForContext(rulesDTO.context, rulesDTO.rules);
    } else {
      req.ability = defineAbilityForContext();
    }
  } catch (error) {
    req.ability = defineAbilityForContext();
  }
  next();
};

export const requireSudo = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user || !req.user.sessionId) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }
  const isSudo = await sudoApplicationService.check(req.user.sessionId);
  if (isSudo) {
    next();
  } else {
    res.status(403).json({ error: 'ERR_SUDO_REQUIRED', message: 'Re-authentication required for this action' });
  }
};

export const requireAbility = (action: Action, subject: AppSubjects) => {
/**
 * Callers: [requireAbility]
 * Callees: [json, status, can, next, log]
 * Description: The returned middleware function that checks if the authenticated user has a specific CASL ability.
 * Keywords: middleware, auth, ability, check, anonymous
 */
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.ability) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED_MISSING_ABILITY' });
      return;
    }

    if (req.ability.can(action, subject)) {
      next();
    } else {
      console.log('Forbidden! user:', req.user, 'rules:', req.ability.rules, 'action:', action, 'subject:', subject);
      res.status(403).json({ error: 'ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS', _userRole: req.user?.role });
    }
  };
};


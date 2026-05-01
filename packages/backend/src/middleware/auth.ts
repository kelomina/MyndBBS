/**
 * 中间件模块：Auth
 *
 * 函数作用：
 *   认证授权相关 Express 中间件，包括 JWT 令牌验证、会话有效性缓存、CASL 权限构建、Sudo 模式检查和能力校验。
 * Purpose:
 *   Express middlewares for authentication and authorization, including JWT token verification,
 *   session validity caching, CASL ability construction, sudo mode check, and ability check.
 *
 * 中文关键词：
 *   认证，授权，JWT，会话，CASL，Sudo，中间件
 * English keywords:
 *   auth, authorization, JWT, session, CASL, sudo, middleware
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { defineAbilityForContext, AppAbility, Action, AppSubjects } from '../lib/casl';
import { accessControlQueryService } from '../queries/identity/AccessControlQueryService';
import { authApplicationService, authCache, sudoApplicationService } from '../registry';

/**
 * 类型名称：AuthRequest
 *
 * 函数作用：
 *   扩展 Express Request，注入认证用户信息和 CASL 权限能力对象。
 * Purpose:
 *   Extends Express Request with authenticated user info and CASL ability object.
 *
 * 中文关键词：
 *   请求，认证用户，权限，CASL
 * English keywords:
 *   request, auth user, ability, CASL
 */
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
    sessionId: string;
  };
  ability?: AppAbility;
}

/**
 * 函数名称：requireAuth
 *
 * 函数作用：
 *   强制认证中间件——校验 JWT access token、检查会话有效性（缓存加速）、
 *   在令牌需要刷新时自动签发新令牌，最后构建 CASL ability 挂载到 req 上。
 * Purpose:
 *   Mandatory auth middleware — verifies JWT access token, checks session validity (cached),
 *   auto-refreshes token when needed, and attaches CASL ability to req.
 *
 * 调用方 / Called by:
 *   Express Router（所有需要认证的路由组）
 *
 * 被调用方 / Calls:
 *   - authCache.getSessionValidity / setSessionValidity / checkRequiresRefresh / extendRefreshGracePeriod
 *   - authApplicationService.validateSession
 *   - accessControlQueryService.getAbilityRulesForUser
 *   - defineAbilityForContext
 *   - jwt.verify / jwt.sign
 *
 * 参数说明 / Parameters:
 *   - req.cookies.accessToken: string | undefined, JWT access token（优先从 Cookie 读取）
 *   - req.headers.authorization: string | undefined, Bearer token（后备来源）
 *
 * 返回值说明 / Returns:
 *   next() 或 401 JSON 错误响应
 *
 * 错误处理 / Error handling:
 *   - 401: ERR_UNAUTHORIZED_MISSING_TOKEN（无令牌）
 *   - 401: ERR_SESSION_REVOKED_OR_INVALID（会话已撤销）
 *   - 401: ERR_USER_BANNED（用户被封禁）
 *   - 401: ERR_INVALID_TOKEN（令牌无效/过期）
 *
 * 副作用 / Side effects:
 *   - 写 Redis——缓存会话有效性状态
 *   - 写 Cookie——自动刷新 access token
 *   - 写 req——注入 user 和 ability
 *
 * 中文关键词：
 *   认证，JWT 校验，会话缓存，令牌刷新，CASL
 * English keywords:
 *   auth, JWT verify, session cache, token refresh, CASL
 */
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

/**
 * 函数名称：optionalAuth
 *
 * 函数作用：
 *   可选认证中间件——如果有有效 JWT 令牌则解析用户和权限，否则以游客身份继续。
 * Purpose:
 *   Optional auth middleware — parses user and ability if a valid JWT token exists,
 *   otherwise continues as a guest.
 *
 * 调用方 / Called by:
 *   Express Router（同时支持登录和未登录用户的路由）
 *
 * 被调用方 / Calls:
 *   - jwt.verify
 *   - accessControlQueryService.getAbilityRulesForUser
 *   - defineAbilityForContext
 *
 * 参数说明 / Parameters:
 *   - req.cookies.accessToken: string | undefined, JWT access token
 *   - req.headers.authorization: string | undefined, Bearer token（后备）
 *
 * 返回值说明 / Returns:
 *   next() — 无论认证成功或失败都继续处理
 *
 * 错误处理 / Error handling:
 *   令牌无效或过期时静默降级为游客身份，不阻断请求
 *
 * 副作用 / Side effects:
 *   写 req——有令牌时注入 user 和 ability，否则注入游客 ability
 *
 * 中文关键词：
 *   可选认证，游客，JWT，CASL
 * English keywords:
 *   optional auth, guest, JWT, CASL
 */
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

/**
 * 函数名称：requireSudo
 *
 * 函数作用：
 *   要求当前会话处于 Sudo 模式（二次认证）的中间件。
 * Purpose:
 *   Middleware that requires the current session to be in sudo mode (re-authentication).
 *
 * 调用方 / Called by:
 *   Express Router（高风险操作如删除 Passkey、管理 TOTP）
 *
 * 被调用方 / Calls:
 *   - sudoApplicationService.check
 *
 * 参数说明 / Parameters:
 *   - req.user.sessionId: string, 当前登录会话 ID
 *
 * 返回值说明 / Returns:
 *   next() 或 401/403 JSON 错误响应
 *
 * 错误处理 / Error handling:
 *   - 401: ERR_UNAUTHORIZED（用户未登录）
 *   - 403: ERR_SUDO_REQUIRED（需要二次认证）
 *
 * 副作用 / Side effects:
 *   无——只读检查 Redis 中的 sudo 状态
 *
 * 中文关键词：
 *   Sudo，二次认证，高风险操作，会话
 * English keywords:
 *   sudo, re-authentication, high-risk operation, session
 */
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

/**
 * 函数名称：requireAbility
 *
 * 函数作用：
 *   要求当前用户具备指定 CASL 能力的中间件工厂。
 *   返回的中间件检查 req.ability.can(action, subject)，不通过则返回 403。
 * Purpose:
 *   Middleware factory that requires the current user to have a specific CASL ability.
 *   The returned middleware checks req.ability.can(action, subject), returns 403 on failure.
 *
 * 调用方 / Called by:
 *   Express Router（需要细粒度权限控制的路由）
 *
 * 被调用方 / Calls:
 *   - req.ability.can
 *
 * 参数说明 / Parameters:
 *   - action: Action, CASL 动作（manage / create / read / update / delete / update_status）
 *   - subject: AppSubjects, CASL 主体（all / AdminPanel / User / Post / Category / Role / Permission / Comment / ModeratedWord）
 *
 * 返回值说明 / Returns:
 *   Express 中间件函数：(req, res, next) => void
 *   next() 或 401/403 JSON 错误响应
 *
 * 错误处理 / Error handling:
 *   - 401: ERR_UNAUTHORIZED_MISSING_ABILITY（未构建权限能力）
 *   - 403: ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS（权限不足）
 *
 * 副作用 / Side effects:
 *   无
 *
 * 中文关键词：
 *   CASL，权限检查，能力校验，中间件工厂
 * English keywords:
 *   CASL, permission check, ability check, middleware factory
 */
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
      res.status(403).json({ error: 'ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS', _userRole: req.user?.role });
    }
  };
};


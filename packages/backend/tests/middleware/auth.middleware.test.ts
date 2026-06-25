import { Response, NextFunction } from 'express';
import { requireAuth, requireAuthHidden, optionalAuth, requireSudo, requireAbility, AuthRequest } from '../../src/middleware/auth';
import { defineAbilityForContext } from '../../src/lib/casl';
import { accessControlQueryService } from '../../src/queries/identity/AccessControlQueryService';
import { authApplicationService, authCache, sudoApplicationService } from '../../src/registry';

jest.mock('../../src/queries/identity/AccessControlQueryService');
jest.mock('../../src/registry');

describe('Auth Middleware', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      cookies: {},
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();

    (authCache.getSessionValidity as jest.Mock).mockResolvedValue(null);
    (authCache.setSessionValidity as jest.Mock).mockResolvedValue(undefined);
    (authCache.hasTrustedExternalAuth as jest.Mock).mockResolvedValue(false);
    (authApplicationService.validateSession as jest.Mock).mockResolvedValue({
      isValid: true,
      user: { id: 'user-1' },
      roleName: 'USER',
    });
    (accessControlQueryService.getAbilityRulesForUser as jest.Mock).mockResolvedValue(undefined);
  });

  describe('requireAuth', () => {
    it('should return 401 when no session cookie is provided', async () => {
      await requireAuth(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'ERR_UNAUTHORIZED_MISSING_SESSION' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should authenticate with a sessionId cookie', async () => {
      mockReq.cookies = { sessionId: 'session-1' };
      (accessControlQueryService.getAbilityRulesForUser as jest.Mock).mockResolvedValue({
        context: { userId: 'user-1', roleName: 'USER', level: 1, moderatedCategoryIds: [] },
        rules: [],
      });

      await requireAuth(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(authApplicationService.validateSession).toHaveBeenCalledWith('session-1');
      expect(mockReq.user).toEqual({
        userId: 'user-1',
        role: 'USER',
        sessionId: 'session-1',
        trustedExternalAuth: false,
        effectiveLevel: 1,
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should apply session-level trusted external auth as effective level 2', async () => {
      mockReq.cookies = { sessionId: 'session-1' };
      (authCache.hasTrustedExternalAuth as jest.Mock).mockResolvedValue(true);
      (accessControlQueryService.getAbilityRulesForUser as jest.Mock).mockResolvedValue({
        context: { userId: 'user-1', roleName: 'USER', level: 1, moderatedCategoryIds: [] },
        rules: [],
      });

      await requireAuth(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(authCache.hasTrustedExternalAuth).toHaveBeenCalledWith('session-1');
      expect(mockReq.user).toEqual({
        userId: 'user-1',
        role: 'USER',
        sessionId: 'session-1',
        trustedExternalAuth: true,
        effectiveLevel: 2,
      });
      expect(mockReq.ability?.can('create', 'Wiki')).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not accept browser-supplied internal session headers', async () => {
      mockReq.headers = { 'x-myndbbs-session-id': 'session-1' };

      await requireAuth(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(authApplicationService.validateSession).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'ERR_UNAUTHORIZED_MISSING_SESSION' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when session is invalid', async () => {
      mockReq.cookies = { sessionId: 'session-1' };
      (authCache.getSessionValidity as jest.Mock).mockResolvedValue('invalid');

      await requireAuth(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockRes.clearCookie).toHaveBeenCalledWith('sessionId', expect.any(Object));
      expect(mockRes.clearCookie).toHaveBeenCalledWith('accessToken', expect.any(Object));
      expect(mockRes.clearCookie).toHaveBeenCalledWith('refreshToken', expect.any(Object));
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'ERR_SESSION_REVOKED_OR_INVALID' });
    });

    it('should not fall back to legacy refresh tokens for revoked sessions', async () => {
      mockReq.cookies = { sessionId: 'session-1', refreshToken: 'legacy-refresh-token' };
      (authCache.getSessionValidity as jest.Mock).mockResolvedValue('invalid');

      await requireAuth(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(authApplicationService.validateSession).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'ERR_SESSION_REVOKED_OR_INVALID' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject banned users without attempting token refresh', async () => {
      mockReq.cookies = { sessionId: 'session-1' };
      (authApplicationService.validateSession as jest.Mock).mockResolvedValue({
        isValid: false,
        reason: 'USER_BANNED',
      });

      await requireAuth(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockRes.clearCookie).toHaveBeenCalledWith('sessionId', expect.any(Object));
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'ERR_USER_BANNED' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate session from database when cache is empty', async () => {
      mockReq.cookies = { sessionId: 'session-1' };
      (authCache.getSessionValidity as jest.Mock).mockResolvedValue(null);

      await requireAuth(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(authApplicationService.validateSession).toHaveBeenCalledWith('session-1');
      expect(authCache.setSessionValidity).toHaveBeenCalledWith('session-1', 'valid', 3600);
    });
  });

  describe('requireAuthHidden', () => {
    it('should return 404 when no session cookie is provided', async () => {
      await requireAuthHidden(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'ERR_NOT_FOUND' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 404 when session is invalid', async () => {
      mockReq.cookies = { sessionId: 'session-1' };
      (authCache.getSessionValidity as jest.Mock).mockResolvedValue('invalid');

      await requireAuthHidden(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockRes.clearCookie).toHaveBeenCalledWith('sessionId', expect.any(Object));
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'ERR_NOT_FOUND' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should authenticate valid sessions like requireAuth', async () => {
      mockReq.cookies = { sessionId: 'session-1' };
      (accessControlQueryService.getAbilityRulesForUser as jest.Mock).mockResolvedValue({
        context: { userId: 'user-1', roleName: 'USER', level: 1, moderatedCategoryIds: [] },
        rules: [],
      });

      await requireAuthHidden(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockReq.user?.userId).toBe('user-1');
      expect(mockReq.ability).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should set guest ability when no session cookie is provided', async () => {
      await optionalAuth(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockReq.ability).toBeDefined();
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should parse valid session and set user/ability', async () => {
      mockReq.cookies = { sessionId: 'session-1' };
      (accessControlQueryService.getAbilityRulesForUser as jest.Mock).mockResolvedValue({
        context: { userId: 'user-1', roleName: 'USER', level: 1, moderatedCategoryIds: [] },
        rules: [],
      });

      await optionalAuth(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockReq.user).toEqual({
        userId: 'user-1',
        role: 'USER',
        sessionId: 'session-1',
        trustedExternalAuth: false,
        effectiveLevel: 1,
      });
      expect(mockReq.ability).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set guest ability when session is invalid', async () => {
      mockReq.cookies = { sessionId: 'session-1' };
      (authApplicationService.validateSession as jest.Mock).mockResolvedValue({
        isValid: false,
        reason: 'SESSION_NOT_FOUND',
      });

      await optionalAuth(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockReq.ability).toBeDefined();
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireSudo', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockReq.user = undefined;

      await requireSudo(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'ERR_UNAUTHORIZED' });
    });

    it('should return 403 when sudo mode is not active', async () => {
      mockReq.user = {
        userId: 'user-1',
        role: 'ADMIN',
        sessionId: 'session-1',
        trustedExternalAuth: false,
        effectiveLevel: 3,
      };
      (sudoApplicationService.check as jest.Mock).mockResolvedValue(false);

      await requireSudo(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'ERR_SUDO_REQUIRED',
        message: 'Re-authentication required for this action',
      });
    });

    it('should call next when sudo mode is active', async () => {
      mockReq.user = {
        userId: 'user-1',
        role: 'ADMIN',
        sessionId: 'session-1',
        trustedExternalAuth: false,
        effectiveLevel: 3,
      };
      (sudoApplicationService.check as jest.Mock).mockResolvedValue(true);

      await requireSudo(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireAbility', () => {
    it('should return 401 when ability is not set', () => {
      mockReq.ability = undefined;
      const middleware = requireAbility('read', 'Post');

      middleware(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'ERR_UNAUTHORIZED_MISSING_ABILITY' });
    });

    it('should return 403 when user lacks required ability', () => {
      mockReq.ability = defineAbilityForContext();
      const middleware = requireAbility('create', 'Post');

      middleware(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS' });
    });

    it('should call next when user has required ability', () => {
      mockReq.ability = defineAbilityForContext({
        userId: 'user-1',
        roleName: 'ADMIN',
        level: 3,
        moderatedCategoryIds: [],
      });
      const middleware = requireAbility('manage', 'all');

      middleware(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });
});

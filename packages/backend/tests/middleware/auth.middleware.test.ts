import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth, optionalAuth, requireSudo, requireAbility, AuthRequest } from '../../src/middleware/auth';
import { defineAbilityForContext } from '../../src/lib/casl';
import { accessControlQueryService } from '../../src/queries/identity/AccessControlQueryService';
import { authApplicationService, authCache, sudoApplicationService } from '../../src/registry';

jest.mock('jsonwebtoken');
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
    (authCache.checkRequiresRefresh as jest.Mock).mockResolvedValue(false);
    (authCache.extendRefreshGracePeriod as jest.Mock).mockResolvedValue(undefined);
    (authApplicationService.validateSession as jest.Mock).mockResolvedValue({
      isValid: true,
      roleName: 'USER',
    });
    (accessControlQueryService.getAbilityRulesForUser as jest.Mock).mockResolvedValue(undefined);
  });

  describe('requireAuth', () => {
    it('should return 401 when no token is provided', async () => {
      await requireAuth(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'ERR_UNAUTHORIZED_MISSING_TOKEN' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should extract token from Authorization header when cookie is missing', async () => {
      mockReq.headers = { authorization: 'Bearer test-token' };
      (jwt.verify as jest.Mock).mockReturnValue({ type: 'access', userId: 'user-1', role: 'USER', sessionId: 'session-1' });
      (authCache.getSessionValidity as jest.Mock).mockResolvedValue('valid');
      (accessControlQueryService.getAbilityRulesForUser as jest.Mock).mockResolvedValue({
        context: { userId: 'user-1', roleName: 'USER', level: 1, moderatedCategoryIds: [] },
        rules: [],
      });

      await requireAuth(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(jwt.verify).toHaveBeenCalledWith('test-token', expect.any(String), { algorithms: ['HS256'] });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 when session is invalid', async () => {
      mockReq.cookies = { accessToken: 'valid-token' };
      (jwt.verify as jest.Mock).mockReturnValue({ type: 'access', userId: 'user-1', role: 'USER', sessionId: 'session-1' });
      (authCache.getSessionValidity as jest.Mock).mockResolvedValue('invalid');

      await requireAuth(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockRes.clearCookie).toHaveBeenCalledWith('accessToken');
      expect(mockRes.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'ERR_SESSION_REVOKED_OR_INVALID' });
    });

    it('should not refresh a revoked session even when a refresh token exists', async () => {
      mockReq.cookies = { accessToken: 'valid-token', refreshToken: 'refresh-token' };
      (jwt.verify as jest.Mock).mockReturnValue({
        type: 'access',
        userId: 'user-1',
        role: 'USER',
        sessionId: 'session-1',
      });
      (authCache.getSessionValidity as jest.Mock).mockResolvedValue('invalid');

      await requireAuth(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(authApplicationService.refreshAccessToken).not.toHaveBeenCalled();
      expect(mockRes.clearCookie).toHaveBeenCalledWith('accessToken');
      expect(mockRes.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'ERR_SESSION_REVOKED_OR_INVALID' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should not refresh when the user has been banned', async () => {
      mockReq.cookies = { accessToken: 'valid-token', refreshToken: 'refresh-token' };
      (jwt.verify as jest.Mock).mockReturnValue({
        type: 'access',
        userId: 'user-1',
        role: 'USER',
        sessionId: 'session-1',
      });
      (authApplicationService.validateSession as jest.Mock).mockResolvedValue({
        isValid: false,
        reason: 'USER_BANNED',
      });

      await requireAuth(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(authApplicationService.refreshAccessToken).not.toHaveBeenCalled();
      expect(mockRes.clearCookie).toHaveBeenCalledWith('accessToken');
      expect(mockRes.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'ERR_USER_BANNED' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate session from database when cache is empty', async () => {
      mockReq.cookies = { accessToken: 'valid-token' };
      (jwt.verify as jest.Mock).mockReturnValue({ type: 'access', userId: 'user-1', role: 'USER', sessionId: 'session-1' });
      (authCache.getSessionValidity as jest.Mock).mockResolvedValue(null);
      (authApplicationService.validateSession as jest.Mock).mockResolvedValue({ isValid: true });

      await requireAuth(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(authApplicationService.validateSession).toHaveBeenCalledWith('session-1', 'user-1');
      expect(authCache.setSessionValidity).toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should set guest ability when no token is provided', async () => {
      await optionalAuth(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockReq.ability).toBeDefined();
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should parse valid token and set user/ability', async () => {
      mockReq.cookies = { accessToken: 'valid-token' };
      (jwt.verify as jest.Mock).mockReturnValue({ type: 'access', userId: 'user-1', role: 'USER', sessionId: 'session-1' });
      (accessControlQueryService.getAbilityRulesForUser as jest.Mock).mockResolvedValue({
        context: { userId: 'user-1', roleName: 'USER', level: 1, moderatedCategoryIds: [] },
        rules: [],
      });

      await optionalAuth(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockReq.user).toEqual({ userId: 'user-1', role: 'USER', sessionId: 'session-1' });
      expect(mockReq.ability).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set guest ability when token is invalid', async () => {
      mockReq.cookies = { accessToken: 'invalid-token' };
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
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
      mockReq.user = { userId: 'user-1', role: 'ADMIN', sessionId: 'session-1' };
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
      mockReq.user = { userId: 'user-1', role: 'ADMIN', sessionId: 'session-1' };
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
      const ability = defineAbilityForContext();
      mockReq.ability = ability;
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
      const ability = defineAbilityForContext();
      mockReq.ability = ability;
      const middleware = requireAbility('read', 'Post');

      middleware(
        mockReq as AuthRequest,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });
});

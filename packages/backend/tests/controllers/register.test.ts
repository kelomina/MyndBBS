import { Request, Response } from 'express';
import {
  registerUser,
  resendEmailRegistration,
  verifyEmailRegistration,
  requestPasswordReset,
  resetPasswordWithToken,
} from '../../src/controllers/register';
import { authApplicationService } from '../../src/registry';

jest.mock('../../src/registry', () => ({
  authApplicationService: {
    registerUser: jest.fn(),
    resendEmailRegistration: jest.fn(),
    verifyEmailRegistration: jest.fn(),
    requestPasswordReset: jest.fn(),
    resetPasswordWithToken: jest.fn(),
    generateTempToken: jest.fn(),
  },
}));

describe('Register Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = {
      body: {},
      cookies: {},
      t: ((_: string, defaultValue: string) => defaultValue) as Request['t'],
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('returns 202 when email registration is accepted', async () => {
    req.body = {
      email: 'user@example.com',
      username: 'demo-user',
      password: 'Aa!12345',
      captchaId: 'captcha-1',
    };

    (authApplicationService.registerUser as jest.Mock).mockResolvedValue({
      email: 'user@example.com',
      expiresAt: new Date('2026-04-24T10:00:00.000Z'),
    });

    await registerUser(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Verification email sent. Please check your inbox.',
      email: 'user@example.com',
      expiresAt: '2026-04-24T10:00:00.000Z',
    });
  });

  it('returns 503 when registration email delivery is not configured', async () => {
    req.body = {
      email: 'user@example.com',
      username: 'demo-user',
      password: 'Aa!12345',
      captchaId: 'captcha-1',
    };
    (authApplicationService.registerUser as jest.Mock)
      .mockRejectedValue(new Error('ERR_EMAIL_DELIVERY_NOT_CONFIGURED'));

    await registerUser(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'ERR_EMAIL_DELIVERY_NOT_CONFIGURED',
    });
  });

  it('returns 500 when registration ticket storage is unavailable', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    req.body = {
      email: 'user@example.com',
      username: 'demo-user',
      password: 'Aa!12345',
      captchaId: 'captcha-1',
    };
    (authApplicationService.registerUser as jest.Mock)
      .mockRejectedValue(new Error('REDIS_UNAVAILABLE'));

    try {
      await registerUser(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'ERR_INTERNAL_SERVER_ERROR',
      });
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('sets tempToken cookie after email verification succeeds', async () => {
    req.body = { token: 'verification-token' };
    (authApplicationService.verifyEmailRegistration as jest.Mock).mockResolvedValue({
      id: 'user-1',
      username: 'demo-user',
      email: 'user@example.com',
      level: 1,
      role: { name: 'USER' },
    });
    (authApplicationService.generateTempToken as jest.Mock).mockReturnValue('temp-token');

    await verifyEmailRegistration(req as Request, res as Response);

    expect(authApplicationService.verifyEmailRegistration).toHaveBeenCalledWith('verification-token');
    expect(res.cookie).toHaveBeenCalledWith(
      'tempToken',
      'temp-token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 202 when registration verification email is resent', async () => {
    req.body = { email: 'user@example.com' };
    (authApplicationService.resendEmailRegistration as jest.Mock).mockResolvedValue({
      email: 'user@example.com',
      expiresAt: new Date('2026-04-24T11:00:00.000Z'),
    });

    await resendEmailRegistration(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Verification email resent. Please check your inbox.',
      email: 'user@example.com',
      expiresAt: '2026-04-24T11:00:00.000Z',
    });
  });

  it('returns 503 when registration verification resend delivery fails', async () => {
    req.body = { email: 'user@example.com' };
    (authApplicationService.resendEmailRegistration as jest.Mock)
      .mockRejectedValue(new Error('ERR_EMAIL_DELIVERY_FAILED'));

    await resendEmailRegistration(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'ERR_EMAIL_DELIVERY_FAILED',
    });
  });

  it('returns 202 when password reset is requested', async () => {
    req.body = { email: 'user@example.com' };
    (authApplicationService.requestPasswordReset as jest.Mock).mockResolvedValue({
      email: 'user@example.com',
      expiresAt: new Date('2026-04-24T12:00:00.000Z'),
    });

    await requestPasswordReset(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({
      message: 'If the mailbox exists, a password reset email has been sent.',
      email: 'user@example.com',
      expiresAt: '2026-04-24T12:00:00.000Z',
    });
  });

  it('returns 503 when password reset email delivery fails', async () => {
    req.body = { email: 'user@example.com' };
    (authApplicationService.requestPasswordReset as jest.Mock)
      .mockRejectedValue(new Error('ERR_EMAIL_DELIVERY_FAILED'));

    await requestPasswordReset(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'ERR_EMAIL_DELIVERY_FAILED',
    });
  });

  it('returns 500 when password reset ticket storage is unavailable', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    req.body = { email: 'user@example.com' };
    (authApplicationService.requestPasswordReset as jest.Mock)
      .mockRejectedValue(new Error('REDIS_UNAVAILABLE'));

    try {
      await requestPasswordReset(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'ERR_INTERNAL_SERVER_ERROR',
      });
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('returns 200 when password reset succeeds', async () => {
    req.body = { token: 'reset-token', password: 'Aa!12345' };
    (authApplicationService.resetPasswordWithToken as jest.Mock).mockResolvedValue(undefined);

    await resetPasswordWithToken(req as Request, res as Response);

    expect(authApplicationService.resetPasswordWithToken).toHaveBeenCalledWith('reset-token', 'Aa!12345');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Password reset completed. Please sign in with your new password.',
    });
  });
});

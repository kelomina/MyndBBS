import { Request, Response } from 'express';
import {
  generatePasskeyAuthenticationOptions,
  generatePasskeyRegistrationOptions,
  generateTotp,
  verifyPasskeyAuthenticationResponse,
  verifyPasskeyRegistrationResponse,
  verifyTotpLogin,
  verifyTotpRegistration,
} from '../../src/controllers/auth';
import { authApplicationService } from '../../src/registry';

jest.mock('../../src/lib/authCookies', () => ({
  clearAuthCookies: jest.fn(),
  setSessionCookie: jest.fn(),
}));

jest.mock('../../src/registry', () => ({
  authApplicationService: {
    getUserFromTempToken: jest.fn(),
    generateTotp: jest.fn(),
    verifyTotpRegistration: jest.fn(),
    generatePasskeyRegistrationOptions: jest.fn(),
    verifyPasskeyRegistration: jest.fn(),
    verifyTotpLogin: jest.fn(),
    processGeneratePasskeyAuthenticationOptions: jest.fn(),
    processPasskeyAuthentication: jest.fn(),
    finalizeAuth: jest.fn(),
  },
}));

describe('Auth Controller public error hardening', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    req = {
      body: {},
      cookies: {},
      headers: {},
      originalUrl: '/api/v1/auth/test',
      ip: '127.0.0.1',
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      clearCookie: jest.fn(),
    };
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  function expectPublicAuthFailure(internalErrorCode: string, statusCode = 401) {
    expect(res.status).toHaveBeenCalledWith(statusCode);
    expect(res.json).toHaveBeenCalledWith({ error: 'ERR_AUTH_REQUEST_INVALID' });
    expect(JSON.stringify((res.json as jest.Mock).mock.calls[0][0])).not.toContain(internalErrorCode);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[Auth] Public authentication flow failed',
      expect.objectContaining({ internalErrorCode }),
    );
  }

  it('hides missing registration temp token details when generating TOTP', async () => {
    (authApplicationService.getUserFromTempToken as jest.Mock).mockResolvedValue(null);

    await generateTotp(req as Request, res as Response);

    expectPublicAuthFailure('ERR_UNAUTHORIZED_OR_TOKEN_EXPIRED');
  });

  it('hides TOTP registration flow state errors', async () => {
    (authApplicationService.getUserFromTempToken as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });
    (authApplicationService.verifyTotpRegistration as jest.Mock).mockRejectedValue(
      new Error('ERR_UNAUTHORIZED_OR_SETUP_NOT_INITIATED_EXPIRED'),
    );

    await verifyTotpRegistration(req as Request, res as Response);

    expectPublicAuthFailure('ERR_UNAUTHORIZED_OR_SETUP_NOT_INITIATED_EXPIRED');
  });

  it('hides missing registration temp token details for passkey setup', async () => {
    (authApplicationService.getUserFromTempToken as jest.Mock).mockResolvedValue(null);

    await generatePasskeyRegistrationOptions(req as Request, res as Response);

    expectPublicAuthFailure('ERR_UNAUTHORIZED');
  });

  it('hides passkey registration verification details', async () => {
    req.body = { response: {}, challengeId: 'challenge-1' };
    (authApplicationService.getUserFromTempToken as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (authApplicationService.verifyPasskeyRegistration as jest.Mock).mockRejectedValue(
      new Error('ERR_CHALLENGE_NOT_FOUND'),
    );

    await verifyPasskeyRegistrationResponse(req as Request, res as Response);

    expectPublicAuthFailure('ERR_CHALLENGE_NOT_FOUND', 400);
  });

  it('hides TOTP login state details', async () => {
    (authApplicationService.getUserFromTempToken as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (authApplicationService.verifyTotpLogin as jest.Mock).mockRejectedValue(
      new Error('ERR_UNAUTHORIZED_OR_TOTP_NOT_ENABLED'),
    );

    await verifyTotpLogin(req as Request, res as Response);

    expectPublicAuthFailure('ERR_UNAUTHORIZED_OR_TOTP_NOT_ENABLED');
  });

  it('hides passkey authentication option generation details', async () => {
    (authApplicationService.processGeneratePasskeyAuthenticationOptions as jest.Mock).mockRejectedValue(
      new Error('ERR_UNAUTHORIZED'),
    );

    await generatePasskeyAuthenticationOptions(req as Request, res as Response);

    expectPublicAuthFailure('ERR_UNAUTHORIZED');
  });

  it('hides passkey authentication verification details', async () => {
    req.body = { response: {}, challengeId: 'challenge-1' };
    (authApplicationService.processPasskeyAuthentication as jest.Mock).mockRejectedValue(
      new Error('ERR_PASSKEY_NOT_FOUND'),
    );

    await verifyPasskeyAuthenticationResponse(req as Request, res as Response);

    expectPublicAuthFailure('ERR_PASSKEY_NOT_FOUND', 400);
  });
});

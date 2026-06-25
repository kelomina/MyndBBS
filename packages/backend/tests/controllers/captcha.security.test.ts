import { Request, Response } from 'express';
import { verifyCaptcha } from '../../src/controllers/captcha';
import { authApplicationService } from '../../src/registry';

jest.mock('../../src/registry', () => ({
  authApplicationService: {
    generateCaptcha: jest.fn(),
    verifyCaptcha: jest.fn(),
  },
}));

describe('Captcha Controller Security', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('returns a generic error when captcha parameters are malformed', async () => {
    req.body = { captchaId: 'captcha-1', dragPath: 'not-an-array' };

    await verifyCaptcha(req as Request, res as Response);

    expect(authApplicationService.verifyCaptcha).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'ERR_VERIFICATION_FAILED',
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[Captcha] Verification failed',
      expect.objectContaining({
        internalErrorCode: 'ERR_INVALID_CAPTCHA_VERIFICATION_REQUEST',
        captchaId: 'captcha-1',
      }),
    );
  });

  it('maps detailed captcha domain failures to a generic public error', async () => {
    req.body = {
      captchaId: 'captcha-1',
      dragPath: [{ x: 1, y: 2, time: 3 }],
      totalDragTime: 800,
      finalPosition: 120,
    };
    (authApplicationService.verifyCaptcha as jest.Mock).mockRejectedValue(
      new Error('ERR_AUTOMATION_DETECTED_LINEAR_TRAJECTORY'),
    );

    await verifyCaptcha(req as Request, res as Response);

    expect(authApplicationService.verifyCaptcha).toHaveBeenCalledWith(
      'captcha-1',
      [{ x: 1, y: 2, t: 3 }],
      800,
      120,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'ERR_VERIFICATION_FAILED',
    });
    expect(JSON.stringify((res.json as jest.Mock).mock.calls[0][0])).not.toContain(
      'ERR_AUTOMATION_DETECTED_LINEAR_TRAJECTORY',
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[Captcha] Verification failed',
      expect.objectContaining({
        internalErrorCode: 'ERR_AUTOMATION_DETECTED_LINEAR_TRAJECTORY',
        captchaId: 'captcha-1',
      }),
    );
  });
});

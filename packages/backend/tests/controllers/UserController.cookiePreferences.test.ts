import { Request, Response } from 'express';
import { updateCookiePreferences } from '../../src/controllers/user';
import { userApplicationService } from '../../src/registry';

jest.mock('../../src/registry', () => ({
  userApplicationService: {
    updateCookiePreferences: jest.fn(),
  },
}));

describe('UserController - updateCookiePreferences', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = {
      user: { userId: 'u1' } as any,
      body: {
        preferences: { analytics: true },
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('should update preferences successfully', async () => {
    (userApplicationService.updateCookiePreferences as jest.Mock).mockResolvedValue(undefined);

    await updateCookiePreferences(req as Request, res as Response);

    expect(userApplicationService.updateCookiePreferences).toHaveBeenCalledWith('u1', { analytics: true });
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('should return 401 if user is not authenticated', async () => {
    req.user = undefined;

    await updateCookiePreferences(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'ERR_UNAUTHORIZED' });
  });

  it('should return 400 if preferences are missing', async () => {
    req.body = {};

    await updateCookiePreferences(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'ERR_NO_FIELDS_TO_UPDATE' });
  });

  it('should return 400 if application service throws an error', async () => {
    (userApplicationService.updateCookiePreferences as jest.Mock).mockRejectedValue(new Error('ERR_UPDATE_FAILED'));

    await updateCookiePreferences(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'ERR_UPDATE_FAILED' });
  });
});

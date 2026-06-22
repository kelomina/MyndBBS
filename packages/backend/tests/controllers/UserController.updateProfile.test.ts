import { Request, Response } from 'express';
import { updateProfile } from '../../src/controllers/user';
import { authApplicationService, sudoApplicationService } from '../../src/registry';
import { identityQueryService } from '../../src/queries/identity/IdentityQueryService';

jest.mock('../../src/registry', () => ({
  authApplicationService: {
    changePasswordWithVerification: jest.fn(),
  },
  sudoApplicationService: {
    check: jest.fn(),
  },
  userApplicationService: {},
}));

jest.mock('../../src/queries/identity/IdentityQueryService', () => ({
  identityQueryService: {
    getUserWithRoleById: jest.fn(),
  },
}));

describe('UserController - updateProfile', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = {
      user: { userId: 'user-1', role: 'USER', sessionId: 'session-1' } as any,
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('asks the frontend to open reauthentication when password changes lack verification', async () => {
    req.body = { password: 'Aa!12345' };
    (sudoApplicationService.check as jest.Mock).mockResolvedValue(false);

    await updateProfile(req as Request, res as Response);

    expect(sudoApplicationService.check).toHaveBeenCalledWith('session-1');
    expect(authApplicationService.changePasswordWithVerification).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'ERR_SUDO_REQUIRED' });
  });

  it('updates the password after the current session has passed reauthentication', async () => {
    req.body = { password: 'Aa!12345' };
    (sudoApplicationService.check as jest.Mock).mockResolvedValue(true);
    (authApplicationService.changePasswordWithVerification as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      username: 'demo-user',
      roleId: null,
    });
    (identityQueryService.getUserWithRoleById as jest.Mock).mockResolvedValue({
      role: { name: 'USER' },
    });

    await updateProfile(req as Request, res as Response);

    expect(authApplicationService.changePasswordWithVerification).toHaveBeenCalledWith(
      'user-1',
      undefined,
      undefined,
      'Aa!12345',
      undefined,
      undefined,
      true,
    );
    expect(res.json).toHaveBeenCalledWith({
      message: 'Profile updated successfully',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        username: 'demo-user',
        roleId: null,
        role: 'USER',
      },
      passwordChanged: true,
    });
  });

  it('does not require reauthentication for username-only profile edits', async () => {
    req.body = { username: 'new-name' };
    (authApplicationService.changePasswordWithVerification as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      username: 'new-name',
      roleId: null,
    });
    (identityQueryService.getUserWithRoleById as jest.Mock).mockResolvedValue({
      role: { name: 'USER' },
    });

    await updateProfile(req as Request, res as Response);

    expect(sudoApplicationService.check).not.toHaveBeenCalled();
    expect(authApplicationService.changePasswordWithVerification).toHaveBeenCalledWith(
      'user-1',
      undefined,
      undefined,
      undefined,
      undefined,
      'new-name',
      false,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ passwordChanged: false }));
  });
});

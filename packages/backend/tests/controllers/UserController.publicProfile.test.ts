import { Request, Response } from 'express';
import { getPublicProfile } from '../../src/controllers/user';
import { identityQueryService } from '../../src/queries/identity/IdentityQueryService';

jest.mock('../../src/registry', () => ({
  authApplicationService: {},
  sudoApplicationService: {},
  userApplicationService: {},
}));

jest.mock('../../src/queries/identity/IdentityQueryService', () => ({
  identityQueryService: {
    getPublicProfile: jest.fn(),
  },
}));

describe('UserController - getPublicProfile', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  const publicProfile = {
    id: 'user-1',
    username: 'Saika',
    avatarUrl: null,
    createdAt: new Date('2026-06-23T00:00:00.000Z'),
    posts: [],
    _count: { posts: 0 },
  };

  beforeEach(() => {
    req = {
      params: { username: 'Saika' },
      ability: {} as any,
    } as any;
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('does not expose role or internal user id to anonymous public profile callers', async () => {
    (identityQueryService.getPublicProfile as jest.Mock).mockResolvedValue(publicProfile);

    await getPublicProfile(req as Request, res as Response);

    expect(res.json).toHaveBeenCalledWith({
      user: {
        username: 'Saika',
        avatarUrl: null,
        createdAt: publicProfile.createdAt,
        posts: [],
        _count: { posts: 0 },
      },
    });
  });

  it('keeps internal user id available to authenticated callers but never exposes role', async () => {
    req.user = { userId: 'viewer-1' } as any;
    (identityQueryService.getPublicProfile as jest.Mock).mockResolvedValue(publicProfile);

    await getPublicProfile(req as Request, res as Response);

    expect(res.json).toHaveBeenCalledWith({
      user: {
        id: 'user-1',
        username: 'Saika',
        avatarUrl: null,
        createdAt: publicProfile.createdAt,
        posts: [],
        _count: { posts: 0 },
      },
    });
    expect((res.json as jest.Mock).mock.calls[0][0].user).not.toHaveProperty('role');
  });
});

import { SystemQueryService } from '../src/queries/system/SystemQueryService';
import { prisma } from '../src/db';

jest.mock('../src/db', () => ({
  prisma: {
    routeWhitelist: {
      findMany: jest.fn(),
    },
  },
}));

describe('SystemQueryService public route whitelist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns only the minimal fields required by the frontend middleware', async () => {
    (prisma.routeWhitelist.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'route-1',
        path: '/admin',
        isPrefix: true,
        minRole: 'MODERATOR',
        description: 'Internal admin area',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      },
    ]);

    const service = new SystemQueryService();
    const result = await service.listPublicRouteWhitelist();

    expect(prisma.routeWhitelist.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'asc' },
      select: {
        path: true,
        isPrefix: true,
        minRole: true,
      },
    });
    expect(result).toEqual([
      {
        path: '/admin',
        isPrefix: true,
        minRole: 'MODERATOR',
      },
    ]);
    expect(result[0]).not.toHaveProperty('id');
    expect(result[0]).not.toHaveProperty('description');
    expect(result[0]).not.toHaveProperty('createdAt');
    expect(result[0]).not.toHaveProperty('updatedAt');
  });
});

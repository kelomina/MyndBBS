import { AdminQueryService } from '../src/queries/admin/AdminQueryService';
import { prisma } from '../src/db';

jest.mock('../src/db', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
    },
  },
}));

describe('AdminQueryService', () => {
  let adminQueryService: AdminQueryService;

  beforeEach(() => {
    adminQueryService = new AdminQueryService();
    jest.clearAllMocks();
  });

  describe('listUsers', () => {
    it('should call prisma.user.findMany without where clause when query is not provided', async () => {
      const mockUsers = [
        {
          id: '1',
          username: 'testuser',
          email: 'test@example.com',
          status: 'ACTIVE',
          level: 1,
          createdAt: new Date('2023-01-01'),
          role: { name: 'USER' },
        },
      ];
      
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      const result = await adminQueryService.listUsers();

      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {},
        take: 1000,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          role: { select: { name: true } },
          status: true,
          level: true,
          createdAt: true,
        },
      });

      expect(result).toEqual([
        {
          id: '1',
          username: 'testuser',
          email: 'test@example.com',
          status: 'ACTIVE',
          level: 1,
          createdAt: mockUsers[0].createdAt,
          role: 'USER',
        },
      ]);
    });

    it('should call prisma.user.findMany with OR where clause when query is provided', async () => {
      const mockUsers = [
        {
          id: '2',
          username: 'admin',
          email: 'admin@example.com',
          status: 'ACTIVE',
          level: 10,
          createdAt: new Date('2023-01-02'),
          role: { name: 'ADMIN' },
        },
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      const query = 'admin';
      const result = await adminQueryService.listUsers(query);

      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 1000,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          role: { select: { name: true } },
          status: true,
          level: true,
          createdAt: true,
        },
      });

      expect(result).toEqual([
        {
          id: '2',
          username: 'admin',
          email: 'admin@example.com',
          status: 'ACTIVE',
          level: 10,
          createdAt: mockUsers[0].createdAt,
          role: 'ADMIN',
        },
      ]);
    });
  });
});

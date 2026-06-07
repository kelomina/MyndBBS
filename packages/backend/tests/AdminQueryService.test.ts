import { AdminQueryService } from '../src/queries/admin/AdminQueryService';
import { prisma } from '../src/db';

jest.mock('../src/db', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
    },
    post: {
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

  describe('listCategories', () => {
    it('should not select or return moderator email addresses', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          name: 'General',
          description: null,
          sortOrder: 1,
          minLevel: 0,
          moderators: [
            {
              userId: 'mod-1',
              user: { id: 'mod-1', username: 'moderator' },
            },
          ],
        },
      ];

      (prisma.category.findMany as jest.Mock).mockResolvedValue(mockCategories);

      const result = await adminQueryService.listCategories();

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        take: 1000,
        orderBy: { sortOrder: 'asc' },
        include: {
          moderators: {
            include: {
              user: { select: { id: true, username: true } },
            },
          },
        },
      });
      expect(result[0].moderators[0].user).toEqual({ id: 'mod-1', username: 'moderator' });
      expect(result[0].moderators[0].user).not.toHaveProperty('email');
    });
  });

  describe('listPosts', () => {
    it('only returns published or pinned posts in the general admin post list', async () => {
      (prisma.post.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'post-1',
          title: 'Published',
          status: 'PUBLISHED',
          author: { id: 'user-1', username: 'author' },
          category: { id: 'cat-1', name: 'General' },
          createdAt: new Date('2023-01-03'),
        },
      ]);

      const ability = {
        rulesFor: jest.fn().mockReturnValue([{ conditions: { categoryId: { $in: ['cat-1'] } } }]),
      };

      await adminQueryService.listPosts(ability as any);

      expect(prisma.post.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          AND: [
            { categoryId: { in: ['cat-1'] } },
            { status: { in: ['PUBLISHED', 'PINNED'] } },
          ],
        },
      }));
    });
  });
});

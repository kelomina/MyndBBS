import { SearchQueryService } from '../src/queries/search/SearchQueryService';
import { prisma } from '../src/db';
import { rulesToPrisma } from '../src/lib/rulesToPrisma';
import { PostStatus, UserStatus } from '@myndbbs/shared';
import { AppAbility } from '../src/lib/casl';

jest.mock('../src/db', () => ({
  prisma: {
    post: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../src/lib/rulesToPrisma', () => ({
  rulesToPrisma: jest.fn(),
}));

describe('SearchQueryService', () => {
  let searchQueryService: SearchQueryService;

  beforeEach(() => {
    searchQueryService = new SearchQueryService();
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should search posts and users based on query and CASL rules', async () => {
      const mockAbility = {} as AppAbility;
      const mockQ = 'test query';

      const mockRule = { status: 'PUBLISHED' };
      (rulesToPrisma as jest.Mock).mockReturnValue(mockRule);

      const mockPosts = [
        {
          id: 'p1',
          title: 'test query title',
          content: 'some content',
          createdAt: new Date('2023-01-01'),
          status: PostStatus.PUBLISHED,
          author: { id: 'u1', username: 'author1', avatarUrl: null },
          category: { id: 'c1', name: 'cat1', description: null },
          _count: { comments: 2, upvotes: 5 },
        },
      ];
      (prisma.post.findMany as jest.Mock).mockResolvedValue(mockPosts);

      const mockUsers = [
        {
          id: 'u2',
          username: 'test query user',
          status: UserStatus.ACTIVE,
          level: 1,
          createdAt: new Date('2023-01-02'),
        },
      ];
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      const result = await searchQueryService.search(mockAbility, mockQ);

      expect(rulesToPrisma).toHaveBeenCalledWith(mockAbility, 'read', 'Post');

      expect(prisma.post.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            mockRule,
            { status: { in: [PostStatus.PUBLISHED, PostStatus.PINNED] } },
            {
              OR: [
                { title: { contains: mockQ, mode: 'insensitive' } },
                { content: { contains: mockQ, mode: 'insensitive' } },
              ],
            },
          ],
        },
        take: 20,
        skip: 0,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { username: true, avatarUrl: true } },
          category: { select: { id: true, name: true, description: true } },
          _count: { select: { comments: true, upvotes: true } },
        },
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          username: { contains: mockQ, mode: 'insensitive' },
          status: UserStatus.ACTIVE,
        },
        take: 20,
        skip: 0,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          level: true,
        },
      });

      expect(result).toEqual({
        posts: mockPosts.map((p) => ({
          id: p.id,
          title: p.title,
          content: p.content,
          createdAt: p.createdAt,
          updatedAt: undefined,
          status: p.status,
          author: { username: p.author.username, avatarUrl: p.author.avatarUrl },
          category: p.category,
          _count: p._count,
        })),
        users: [
          {
            id: 'u2',
            username: 'test query user',
            level: 1,
          },
        ],
      });
    });

    it('should correctly apply CASL permission isolation for restricted users', async () => {
      const mockAbility = {} as AppAbility;
      const mockQ = 'secret';

      // Mock restricted rules where user can only read their own posts
      const mockRestrictedRule = { authorId: 'u1' };
      (rulesToPrisma as jest.Mock).mockReturnValue(mockRestrictedRule);

      (prisma.post.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      await searchQueryService.search(mockAbility, mockQ);

      // Verify that rulesToPrisma is called properly
      expect(rulesToPrisma).toHaveBeenCalledWith(mockAbility, 'read', 'Post');

      // Verify the where clause correctly merges the CASL rule and the search query
      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              mockRestrictedRule,
              { status: { in: [PostStatus.PUBLISHED, PostStatus.PINNED] } },
              {
                OR: [
                  { title: { contains: mockQ, mode: 'insensitive' } },
                  { content: { contains: mockQ, mode: 'insensitive' } },
                ],
              },
            ],
          },
        })
      );
    });

    it('should only expose public search user fields', async () => {
      const mockAbility = {} as AppAbility;
      (rulesToPrisma as jest.Mock).mockReturnValue({ status: 'PUBLISHED' });
      (prisma.post.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'u2',
          username: 'visible-user',
          status: UserStatus.ACTIVE,
          level: 3,
          createdAt: new Date('2023-01-02'),
        },
      ]);

      const result = await searchQueryService.search(mockAbility, 'visible');

      expect(result.users).toEqual([
        {
          id: 'u2',
          username: 'visible-user',
          level: 3,
        },
      ]);
      expect(result.users[0]).not.toHaveProperty('status');
      expect(result.users[0]).not.toHaveProperty('createdAt');
    });

    it('should hide non-active users when Prisma fallback search is used', async () => {
      const mockAbility = {} as AppAbility;
      (rulesToPrisma as jest.Mock).mockReturnValue({ status: 'PUBLISHED' });
      (prisma.post.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      await searchQueryService.search(mockAbility, 'user');

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            username: { contains: 'user', mode: 'insensitive' },
            status: UserStatus.ACTIVE,
          }),
        }),
      );
    });
  });
});

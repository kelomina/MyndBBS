import { IdentityQueryService } from '../src/queries/identity/IdentityQueryService';
import { defineAbilityForContext } from '../src/lib/casl';
import { prisma } from '../src/db';

jest.mock('../src/db', () => ({
  prisma: {
    bookmark: {
      findMany: jest.fn(),
    },
    commentBookmark: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

describe('IdentityQueryService security filters', () => {
  let service: IdentityQueryService;

  beforeEach(() => {
    service = new IdentityQueryService();
    jest.clearAllMocks();
  });

  it('filters bookmarks by current post and comment visibility', async () => {
    const ability = defineAbilityForContext({
      userId: 'user-1',
      roleName: 'USER',
      level: 1,
      moderatedCategoryIds: [],
    });
    (prisma.bookmark.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.commentBookmark.findMany as jest.Mock).mockResolvedValue([]);

    await service.listBookmarks('user-1', ability);

    expect(prisma.bookmark.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'user-1',
        post: expect.objectContaining({
          AND: expect.arrayContaining([
            { status: { in: ['PUBLISHED', 'PINNED'] } },
          ]),
        }),
      }),
    }));
    expect(prisma.commentBookmark.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'user-1',
        comment: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              post: expect.objectContaining({
                AND: expect.arrayContaining([
                  { status: { in: ['PUBLISHED', 'PINNED'] } },
                ]),
              }),
            }),
          ]),
        }),
      }),
    }));
  });

  it('filters public profile posts by normal readable statuses', async () => {
    const ability = defineAbilityForContext({
      userId: 'viewer-1',
      roleName: 'MODERATOR',
      level: 2,
      moderatedCategoryIds: [],
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await service.getPublicProfile('author', ability);

    const select = (prisma.user.findUnique as jest.Mock).mock.calls[0][0].select;
    expect(select.posts.where.AND).toEqual(expect.arrayContaining([
      { status: { in: ['PUBLISHED', 'PINNED'] } },
    ]));
    expect(select._count.select.posts.where.AND).toEqual(expect.arrayContaining([
      { status: { in: ['PUBLISHED', 'PINNED'] } },
    ]));
  });

  it('does not select or return role details in public profiles', async () => {
    const ability = defineAbilityForContext();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      username: 'author',
      avatarUrl: null,
      createdAt: new Date('2026-06-23T00:00:00.000Z'),
      posts: [],
      _count: { posts: 0 },
    });

    const result = await service.getPublicProfile('author', ability);

    const select = (prisma.user.findUnique as jest.Mock).mock.calls[0][0].select;
    expect(select.role).toBeUndefined();
    expect(result).not.toHaveProperty('role');
  });
});

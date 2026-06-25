import { CommunityQueryService } from '../src/queries/community/CommunityQueryService';
import { defineAbilityForContext } from '../src/lib/casl';
import { prisma } from '../src/db';

jest.mock('../src/db', () => ({
  prisma: {
    post: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    comment: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    commentUpvote: {
      findMany: jest.fn(),
    },
    commentBookmark: {
      findMany: jest.fn(),
    },
  },
}));

describe('CommunityQueryService security filters', () => {
  let service: CommunityQueryService;
  const ability = defineAbilityForContext({
    userId: 'mod-1',
    roleName: 'MODERATOR',
    level: 2,
    moderatedCategoryIds: [],
  });

  beforeEach(() => {
    service = new CommunityQueryService();
    jest.clearAllMocks();
  });

  it('requires normal readable post statuses for post details', async () => {
    (prisma.post.findFirst as jest.Mock).mockResolvedValue(null);

    await service.getPostById(ability, 'post-1');

    expect((prisma.post.findFirst as jest.Mock).mock.calls[0][0].where.AND).toEqual(expect.arrayContaining([
      { id: 'post-1' },
      { status: { in: ['PUBLISHED', 'PINNED'] } },
    ]));
  });

  it('requires normal readable post statuses before listing comments', async () => {
    (prisma.post.findFirst as jest.Mock).mockResolvedValue(null);

    await service.listPostComments({ ability, postId: 'post-1' });

    expect((prisma.post.findFirst as jest.Mock).mock.calls[0][0].where.AND).toEqual(expect.arrayContaining([
      { id: 'post-1' },
      { status: { in: ['PUBLISHED', 'PINNED'] } },
    ]));
    expect(prisma.comment.findMany).not.toHaveBeenCalled();
  });


  it('bounds default post list size to reduce public scraping blast radius', async () => {
    (prisma.post.findMany as jest.Mock).mockResolvedValue([]);

    await service.listPosts({ ability });

    expect((prisma.post.findMany as jest.Mock).mock.calls[0][0].take).toBe(20);
  });

  it('caps oversized post and comment page sizes at the query boundary', async () => {
    (prisma.post.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.post.findFirst as jest.Mock).mockResolvedValue({ id: 'post-1' });
    (prisma.comment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.comment.count as jest.Mock).mockResolvedValue(0);

    await service.listPosts({ ability, take: 9999 });
    await service.listPostComments({ ability, postId: 'post-1', skip: -10, take: 9999 });

    expect((prisma.post.findMany as jest.Mock).mock.calls[0][0].take).toBe(100);
    expect((prisma.comment.findMany as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        skip: 0,
        take: 100,
      }),
    );
  });
  it('does not expose author ids in public post and comment lists', async () => {
    const publicAbility = defineAbilityForContext({
      userId: 'viewer-1',
      roleName: 'USER',
      level: 1,
      moderatedCategoryIds: [],
    });

    (prisma.post.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'post-1',
        title: 'hello',
        content: 'world',
        createdAt: new Date('2026-06-23T00:00:00.000Z'),
        updatedAt: new Date('2026-06-23T00:00:00.000Z'),
        status: 'PUBLISHED',
        author: { id: 'author-1', username: 'author', avatarUrl: null },
        category: { id: 'cat-1', name: 'General', description: null },
        _count: { comments: 0, upvotes: 0 },
      },
    ]);
    (prisma.post.findFirst as jest.Mock).mockResolvedValue({ id: 'post-1' });
    (prisma.comment.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'comment-1',
        content: 'public comment',
        createdAt: new Date('2026-06-23T00:00:00.000Z'),
        updatedAt: new Date('2026-06-23T00:00:00.000Z'),
        deletedAt: null,
        isPending: false,
        parentId: null,
        author: { id: 'author-2', username: 'commenter', avatarUrl: null },
        _count: { upvotes: 0, bookmarks: 0, replies: 0 },
      },
    ]);
    (prisma.comment.count as jest.Mock).mockResolvedValue(1);

    const postsResult = await service.listPosts({ ability: publicAbility, take: 10 });
    const commentsResult = await service.listPostComments({ ability: publicAbility, postId: 'post-1' });

    expect(postsResult[0]?.author).toEqual({ username: 'author', avatarUrl: null });
    expect(postsResult[0]).not.toHaveProperty('author.id');
    expect(commentsResult?.data[0]?.author).toEqual({ username: 'commenter', avatarUrl: null });
    expect(commentsResult?.data[0]).not.toHaveProperty('author.id');
  });

  it('redacts deleted comment content from public comment lists', async () => {
    const deletedAt = new Date('2026-06-23T00:00:00.000Z');
    (prisma.post.findFirst as jest.Mock).mockResolvedValue({ id: 'post-1' });
    (prisma.comment.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'comment-1',
        content: 'deleted body should stay out of public DTOs',
        createdAt: new Date('2026-06-22T00:00:00.000Z'),
        updatedAt: null,
        deletedAt,
        isPending: false,
        parentId: null,
        author: { id: 'user-1', username: 'saika', avatarUrl: null },
        _count: { upvotes: 0, bookmarks: 0, replies: 0 },
      },
    ]);
    (prisma.comment.count as jest.Mock).mockResolvedValue(1);

    const result = await service.listPostComments({ ability, postId: 'post-1' });

    expect(result?.data[0]?.content).toBe('');
    expect(result?.data[0]?.deletedAt).toBe(deletedAt);
    expect(result?.data[0]?.author).toEqual({ username: 'saika', avatarUrl: null });
    expect(result?.data[0]?.author).not.toHaveProperty('id');
  });
});

import { CommunityQueryService } from '../src/queries/community/CommunityQueryService';
import { defineAbilityForContext } from '../src/lib/casl';
import { prisma } from '../src/db';

jest.mock('../src/db', () => ({
  prisma: {
    post: {
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
  });
});

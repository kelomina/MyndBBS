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
});

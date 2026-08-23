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
    commentUpvote: { findMany: jest.fn() },
    commentBookmark: { findMany: jest.fn() },
  },
}));

describe('CommunityQueryService author badges', () => {
  let service: CommunityQueryService;
  const ability = defineAbilityForContext({
    userId: 'viewer-1',
    roleName: 'USER',
    level: 1,
    moderatedCategoryIds: [],
  });

  const badgeRows = [
    {
      badge: { id: 'b-official', code: 'kolostudio_official', name: 'KoloStudio Official', icon: '✦', color: 'amber', type: 'SYSTEM' },
    },
    {
      badge: { id: 'b-custom', code: 'bug_hunter', name: 'Bug Hunter', icon: '🐛', color: 'green', type: 'CUSTOM' },
    },
  ];

  beforeEach(() => {
    service = new CommunityQueryService();
    jest.clearAllMocks();
  });

  it('flattens author badges in post detail responses', async () => {
    (prisma.post.findFirst as jest.Mock).mockResolvedValue({
      id: 'post-1',
      title: 'hello',
      content: 'world',
      createdAt: new Date('2026-08-23T00:00:00.000Z'),
      updatedAt: new Date('2026-08-23T00:00:00.000Z'),
      status: 'PUBLISHED',
      author: { username: 'author', avatarUrl: null, badges: badgeRows },
      category: { id: 'cat-1', name: 'General', description: null },
      _count: { comments: 0, upvotes: 0, bookmarks: 0 },
    });

    const result = await service.getPostById(ability, 'post-1');

    expect(result?.author.badges).toEqual([
      { id: 'b-official', code: 'kolostudio_official', name: 'KoloStudio Official', icon: '✦', color: 'amber', type: 'SYSTEM' },
      { id: 'b-custom', code: 'bug_hunter', name: 'Bug Hunter', icon: '🐛', color: 'green', type: 'CUSTOM' },
    ]);
    // 查询层面只取启用中的徽章，且按徽章 sortOrder 排序
    const select = (prisma.post.findFirst as jest.Mock).mock.calls[0][0].include.author.select;
    expect(select.badges.where).toEqual({ badge: { isActive: true } });
    expect(select.badges.orderBy).toEqual([
      { badge: { sortOrder: 'asc' } },
      { createdAt: 'asc' },
    ]);
  });

  it('flattens author badges for every listed comment and tolerates missing badges', async () => {
    (prisma.post.findFirst as jest.Mock).mockResolvedValue({ id: 'post-1' });
    (prisma.comment.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'comment-1',
        content: 'nice',
        createdAt: new Date('2026-08-23T00:00:00.000Z'),
        updatedAt: new Date('2026-08-23T00:00:00.000Z'),
        deletedAt: null,
        isPending: false,
        parentId: null,
        author: { username: 'collector', avatarUrl: null, badges: [badgeRows[0]] },
        _count: { upvotes: 0, bookmarks: 0, replies: 0 },
      },
      {
        id: 'comment-2',
        content: 'plain',
        createdAt: new Date('2026-08-23T00:01:00.000Z'),
        updatedAt: new Date('2026-08-23T00:01:00.000Z'),
        deletedAt: null,
        isPending: false,
        parentId: null,
        author: { username: 'newcomer', avatarUrl: null },
        _count: { upvotes: 0, bookmarks: 0, replies: 0 },
      },
    ]);
    (prisma.comment.count as jest.Mock).mockResolvedValue(2);

    const result = await service.listPostComments({ ability, postId: 'post-1' });

    expect(result?.data[0]?.author.badges).toHaveLength(1);
    expect(result?.data[0]?.author.badges?.[0]?.code).toBe('kolostudio_official');
    expect(result?.data[1]?.author.badges).toEqual([]);
    // 评论查询同样注入 isActive 过滤
    const select = (prisma.comment.findMany as jest.Mock).mock.calls[0][0].include.author.select;
    expect(select.badges.where).toEqual({ badge: { isActive: true } });
  });
});

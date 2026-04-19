import { communityQueryService } from '../src/queries/community/CommunityQueryService';
import { prisma } from '../src/db';
import { AppAbility } from '@myndbbs/shared';

jest.mock('../src/db', () => ({
  prisma: {
    post: {
      findMany: jest.fn(),
    },
  },
}));

describe('CommunityQueryService - Popular Algorithm', () => {
  const mockAbility = {
    can: jest.fn().mockReturnValue(true),
    rulesFor: jest.fn().mockReturnValue([{ conditions: {} }]),
    rules: [],
  } as unknown as AppAbility;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should sort posts by popular algorithm correctly', async () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 1000 * 60 * 60);
    const tenHoursAgo = new Date(now.getTime() - 1000 * 60 * 60 * 10);

    const mockPosts = [
      {
        id: 'post-old-high-engagement',
        title: 'Old but high engagement',
        content: 'Content',
        createdAt: tenHoursAgo,
        status: 'PUBLISHED',
        author: { id: 'u1', username: 'user1' },
        category: { id: 'c1', name: 'tech', description: '' },
        _count: { comments: 50, upvotes: 100 },
      },
      {
        id: 'post-new-low-engagement',
        title: 'New but low engagement',
        content: 'Content',
        createdAt: oneHourAgo,
        status: 'PUBLISHED',
        author: { id: 'u2', username: 'user2' },
        category: { id: 'c1', name: 'tech', description: '' },
        _count: { comments: 2, upvotes: 5 },
      },
      {
        id: 'post-new-high-engagement',
        title: 'New and high engagement',
        content: 'Content',
        createdAt: oneHourAgo,
        status: 'PUBLISHED',
        author: { id: 'u3', username: 'user3' },
        category: { id: 'c1', name: 'tech', description: '' },
        _count: { comments: 40, upvotes: 80 },
      }
    ];

    (prisma.post.findMany as jest.Mock).mockResolvedValue(mockPosts);

    const result = await communityQueryService.listPosts({
      ability: mockAbility,
      sortBy: 'popular',
    });

    // Expected order:
    // 1. post-new-high-engagement (high engagement + very recent)
    // 2. post-old-high-engagement (high engagement but decayed due to age)
    // 3. post-new-low-engagement (very recent but low engagement)
    // Note: The actual relative order of 2 and 3 depends on the exact numbers, 
    // but definitely 'new-high-engagement' should be first.
    expect(result[0].id).toBe('post-new-high-engagement');
    expect(result.map(p => p.id)).toEqual([
      'post-new-high-engagement',
      'post-old-high-engagement',
      'post-new-low-engagement'
    ]);
  });
});

import { RedisModerationPolicy } from '../../../src/infrastructure/services/RedisModerationPolicy';
import { redis } from '../../../src/lib/redis';

jest.mock('../../../src/lib/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

class FakeModeratedWordRepo {
  async findAll() {
    return [
      { word: 'bad', categoryId: null },
      { word: 'worse', categoryId: 'cat1' },
    ];
  }
}

describe('RedisModerationPolicy', () => {
  it('loads words from repo and caches them', async () => {
    (redis.get as jest.Mock).mockResolvedValueOnce(null);
    const policy = new RedisModerationPolicy(new FakeModeratedWordRepo() as any);
    
    const contains = await policy.containsModeratedWord('this is bad');
    expect(contains).toBe(true);
    expect(redis.set).toHaveBeenCalledWith(
      'moderation:words',
      JSON.stringify({ global: ['bad'], category: { cat1: ['worse'] } }),
      'EX',
      3600
    );
  });
});

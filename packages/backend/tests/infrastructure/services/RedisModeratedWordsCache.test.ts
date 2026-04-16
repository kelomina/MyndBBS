import { RedisModeratedWordsCache } from '../../../src/infrastructure/services/RedisModeratedWordsCache';
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

describe('RedisModeratedWordsCache', () => {
  it('loads words from repo and caches them', async () => {
    (redis.get as jest.Mock).mockResolvedValueOnce(null);
    const cache = new RedisModeratedWordsCache(new FakeModeratedWordRepo() as any);
    
    const words = await cache.getModerationWords();
    expect(words.global).toContain('bad');
    expect(redis.set).toHaveBeenCalledWith(
      'moderation:words',
      JSON.stringify({ global: ['bad'], category: { cat1: ['worse'] } }),
      'EX',
      3600
    );
  });
});

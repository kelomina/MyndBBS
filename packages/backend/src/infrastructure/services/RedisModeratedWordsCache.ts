import { IModeratedWordsCache } from '../../domain/community/IModeratedWordsCache';
import { IModeratedWordRepository } from '../../domain/community/IModeratedWordRepository';
import { redis } from '../../lib/redis';

const MODERATION_CACHE_KEY = 'moderation:words';

export class RedisModeratedWordsCache implements IModeratedWordsCache {
  constructor(private moderatedWordRepository: IModeratedWordRepository) {}

  public async getModerationWords(): Promise<{ global: string[], category: Record<string, string[]> }> {
    const cached = await redis.get(MODERATION_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (
          parsed &&
          typeof parsed === 'object' &&
          'global' in parsed &&
          Array.isArray(parsed.global) &&
          'category' in parsed &&
          typeof parsed.category === 'object' &&
          parsed.category !== null
        ) {
          return parsed as { global: string[]; category: Record<string, string[]> };
        }
      } catch {
        // Cache miss on malformed data
      }
    }

    const words = await this.moderatedWordRepository.findAll();
    const global: string[] = [];
    const category: Record<string, string[]> = {};

    for (const w of words) {
      if (w.categoryId) {
        const catId = w.categoryId;
        if (!category[catId]) category[catId] = [];
        category[catId]!.push(w.word);
      } else {
        global.push(w.word);
      }
    }

    const result = { global, category };
    await redis.set(MODERATION_CACHE_KEY, JSON.stringify(result), 'EX', 3600); // 1 hour cache
    return result;
  }

  public async clearCache(): Promise<void> {
    await redis.del(MODERATION_CACHE_KEY);
  }
}

import { systemQueryService } from '../queries/system/SystemQueryService';
import { redis } from './redis';

const MODERATION_CACHE_KEY = 'moderation_words';

/**
 * Callers: []
 * Callees: [get, parse, findMany, push, set, stringify]
 * Description: Handles the get moderation words logic for the application.
 * Keywords: getmoderationwords, get, moderation, words, auto-annotated
 */
export const getModerationWords = async (): Promise<{ global: string[], category: Record<string, string[]> }> => {
  const cached = await redis.get(MODERATION_CACHE_KEY);
  if (cached) {
    return JSON.parse(cached);
  }

  const words = await prisma.moderatedWord.findMany();
  const global: string[] = [];
  const category: Record<string, string[]> = {};

  for (const w of words) {
    if (w.categoryId) {
      const catId = w.categoryId as string;
      if (!category[catId]) category[catId] = [];
      category[catId]!.push(w.word);
    } else {
      global.push(w.word);
    }
  }

  const result = { global, category };
  await redis.set(MODERATION_CACHE_KEY, JSON.stringify(result), 'EX', 3600); // 1 hour cache
  return result;
};

/**
 * Callers: []
 * Callees: [del]
 * Description: Handles the clear moderation cache logic for the application.
 * Keywords: clearmoderationcache, clear, moderation, cache, auto-annotated
 */
export const clearModerationCache = async () => {
  await redis.del(MODERATION_CACHE_KEY);
};

/**
 * Callers: []
 * Callees: [getModerationWords, includes]
 * Description: Handles the contains moderated word logic for the application.
 * Keywords: containsmoderatedword, contains, moderated, word, auto-annotated
 */
export const containsModeratedWord = async (text: string, categoryId?: string): Promise<boolean> => {
  if (!text) return false;
  const { global, category } = await getModerationWords();
  
  // Check global words
  for (const word of global) {
    if (text.includes(word)) return true;
  }
  
  // Check category words
  if (categoryId && category[categoryId]) {
    for (const word of category[categoryId]) {
      if (text.includes(word)) return true;
    }
  }
  
  return false;
};

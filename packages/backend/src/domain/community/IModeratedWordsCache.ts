/**
 * 接口名称：IModeratedWordsCache
 *
 * 函数作用：
 *   敏感词缓存接口——定义获取和清除敏感词缓存的契约。
 * Purpose:
 *   Moderated words cache interface — defines the contract for getting and clearing the moderation cache.
 *
 * 中文关键词：
 *   敏感词，缓存，接口
 * English keywords:
 *   moderated word, cache, interface
 */
export interface IModeratedWordsCache {
  getModerationWords(): Promise<{ global: string[]; category: Record<string, string[]> }>;
  clearCache(): Promise<void>;
}

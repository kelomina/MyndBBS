/**
 * 接口名称：IModerationPolicy
 *
 * 函数作用：
 *   内容审核策略接口——定义检测敏感词和清除缓存的契约。
 * Purpose:
 *   Moderation policy interface — defines the contract for detecting moderated words and clearing caches.
 *
 * 中文关键词：
 *   审核策略，敏感词检测，接口
 * English keywords:
 *   moderation policy, word detection, interface
 */
export interface IModerationPolicy {
  containsModeratedWord(text: string, categoryId?: string): Promise<boolean>;
  clearCache(): Promise<void>;
}

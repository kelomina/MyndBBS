export interface IModeratedWordsCache {
  getModerationWords(): Promise<{ global: string[]; category: Record<string, string[]> }>;
  clearCache(): Promise<void>;
}

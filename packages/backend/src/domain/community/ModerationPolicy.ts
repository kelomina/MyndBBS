import { IModerationPolicy } from './IModerationPolicy';
import { IModeratedWordsCache } from './IModeratedWordsCache';

export class ModerationPolicy implements IModerationPolicy {
  constructor(private moderatedWordsCache: IModeratedWordsCache) {}

  public async containsModeratedWord(text: string, categoryId?: string): Promise<boolean> {
    if (!text) return false;
    const { global, category } = await this.moderatedWordsCache.getModerationWords();
    
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
  }

  public async clearCache(): Promise<void> {
    await this.moderatedWordsCache.clearCache();
  }
}

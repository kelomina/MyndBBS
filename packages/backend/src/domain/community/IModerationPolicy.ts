export interface IModerationPolicy {
  containsModeratedWord(text: string, categoryId?: string): Promise<boolean>;
  clearCache(): Promise<void>;
}

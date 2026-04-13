export interface ModeratedWordProps {
  id: string;
  word: string;
  categoryId: string | null; // null means global
  createdAt: Date;
}

/**
 * Callers: [PrismaModeratedWordRepository, ModerationApplicationService]
 * Callees: []
 * Description: Represents a ModeratedWord Aggregate Root. Encapsulates a banned word rule globally or for a specific category.
 * Keywords: moderatedword, aggregate, root, domain, entity, moderation, filter
 */
export class ModeratedWord {
  private props: ModeratedWordProps;

  /**
   * Callers: [ModeratedWord.create, PrismaModeratedWordRepository.toDomain]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, moderatedword, entity, instantiation
   */
  private constructor(props: ModeratedWordProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [PrismaModeratedWordRepository, ModerationApplicationService]
   * Callees: [ModeratedWord.constructor]
   * Description: Static factory method creating a new ModeratedWord entity. Validates that the word is not empty.
   * Keywords: create, factory, moderatedword, domain, instantiation
   */
  public static create(props: ModeratedWordProps): ModeratedWord {
    if (!props.word || props.word.trim().length === 0) {
      throw new Error('ERR_MODERATED_WORD_CANNOT_BE_EMPTY');
    }
    return new ModeratedWord(props);
  }

  // --- Accessors ---

  public get id(): string { return this.props.id; }
  public get word(): string { return this.props.word; }
  public get categoryId(): string | null { return this.props.categoryId; }
  public get createdAt(): Date { return this.props.createdAt; }

  // --- Domain Behaviors ---

  /**
   * Updates the moderated word content.
   */
  public updateWord(newWord: string): void {
    if (!newWord || newWord.trim().length === 0) {
      throw new Error('ERR_MODERATED_WORD_CANNOT_BE_EMPTY');
    }
    this.props.word = newWord.trim();
  }

  /**
   * Moves the moderated word to a different category, or makes it global (null).
   */
  public changeCategory(categoryId: string | null): void {
    this.props.categoryId = categoryId;
  }
}
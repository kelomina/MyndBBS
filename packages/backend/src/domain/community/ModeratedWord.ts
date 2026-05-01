export interface ModeratedWordProps {
  id: string;
  word: string;
  categoryId: string | null; // null means global
  createdAt: Date;
}

/**
 * 类名称：ModeratedWord
 *
 * 函数作用：
 *   审核域中的敏感词聚合根。表示一条全局或分类级别的禁用词规则。
 * Purpose:
 *   ModeratedWord Aggregate Root. Encapsulates a banned word rule globally or for a specific category.
 *
 * 调用方 / Called by:
 *   - PrismaModeratedWordRepository
 *   - ModerationApplicationService
 *
 * 中文关键词：
 *   敏感词，审核，聚合根
 * English keywords:
 *   moderated word, moderation, aggregate root
 */
export class ModeratedWord {
  private props: ModeratedWordProps;

  /**
   * 函数名称：constructor（私有）
   *
   * 函数作用：
   *   私有构造函数，强制通过静态工厂方法实例化。
   * Purpose:
   *   Private constructor to enforce instantiation via static factory methods.
   */
  private constructor(props: ModeratedWordProps) {
    this.props = { ...props };
  }

  /**
   * 函数名称：create
   *
   * 函数作用：
   *   静态工厂方法——创建新的敏感词，校验内容不为空。
   * Purpose:
   *   Static factory method — creates a new ModeratedWord, validates the word is not empty.
   *
   * 调用方 / Called by:
   *   - ModerationApplicationService.addModeratedWord
   *   - PrismaModeratedWordRepository
   *
   * 参数说明 / Parameters:
   *   - props: ModeratedWordProps, 敏感词属性（word 必填）
   *
   * 错误处理 / Error handling:
   *   - ERR_MODERATED_WORD_CANNOT_BE_EMPTY
   *
   * 中文关键词：
   创建敏感词，工厂方法
   * English keywords:
   *   create moderated word, factory method
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
   * 函数名称：updateWord
   *
   * 函数作用：
   *   更新敏感词的内容。
   * Purpose:
   *   Updates the moderated word content.
   *
   * 参数说明 / Parameters:
   *   - newWord: string, 新敏感词内容（不能为空）
   *
   * 错误处理 / Error handling:
   *   - ERR_MODERATED_WORD_CANNOT_BE_EMPTY
   *
   * 中文关键词：
   更新敏感词
   * English keywords:
   *   update moderated word
   */
  public updateWord(newWord: string): void {
    if (!newWord || newWord.trim().length === 0) {
      throw new Error('ERR_MODERATED_WORD_CANNOT_BE_EMPTY');
    }
    this.props.word = newWord.trim();
  }

  /**
   * 函数名称：changeCategory
   *
   * 函数作用：
   *   将敏感词移到其他分类，或设为全局（null）。
   * Purpose:
   *   Moves the moderated word to a different category, or makes it global (null).
   *
   * 参数说明 / Parameters:
   *   - categoryId: string | null, 目标分类 ID（null 表示全局）
   *
   * 中文关键词：
   更改敏感词分类
   * English keywords:
   *   change moderated word category
   */
  public changeCategory(categoryId: string | null): void {
    this.props.categoryId = categoryId;
  }
}
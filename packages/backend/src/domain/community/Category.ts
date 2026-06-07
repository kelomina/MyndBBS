export interface CategoryProps {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  minLevel: number;
  moderatorIds: string[];
  createdAt: Date;
}

/**
 * 类名称：Category
 *
 * 函数作用：
 *   社区域中的分类聚合根。封装论坛分类的不变约束，如最低发帖等级。
 * Purpose:
 *   Category Aggregate Root within the Community domain. Encapsulates forum section invariants like minimum level requirements.
 *
 * 调用方 / Called by:
 *   - PrismaCategoryRepository
 *   - CommunityApplicationService
 *
 * 中文关键词：
 *   分类，聚合根，领域实体，论坛，等级
 * English keywords:
 *   category, aggregate root, domain entity, forum, level
 */
export class Category {
  private props: CategoryProps;

  /**
   * 函数名称：constructor（私有）
   *
   * 函数作用：
   *   私有构造函数，强制通过静态工厂方法实例化。
   * Purpose:
   *   Private constructor to enforce instantiation via static factory methods.
   */
  private constructor(props: CategoryProps) {
    this.props = { ...props };
  }

  /**
   * 函数名称：create
   *
   * 函数作用：
   *   静态工厂方法——创建新分类，校验名称不为空且最小等级非负。
   * Purpose:
   *   Static factory method — creates a new Category, validates non-empty name and non-negative minLevel.
   *
   * 调用方 / Called by:
   *   - PrismaCategoryRepository.toDomain
   *   - CommunityApplicationService.createCategory
   *
   * 参数说明 / Parameters:
   *   - props: CategoryProps, 分类属性（name 必填，minLevel 默认 0）
   *
   * 返回值说明 / Returns:
   *   Category 新分类实例
   *
   * 错误处理 / Error handling:
   *   - ERR_CATEGORY_NAME_CANNOT_BE_EMPTY（名称为空）
   *   - ERR_CATEGORY_MIN_LEVEL_CANNOT_BE_NEGATIVE（等级为负）
   *
   * 中文关键词：
   *   创建，工厂方法，分类，校验
   * English keywords:
   *   create, factory method, category, validation
   */
  public static create(props: CategoryProps): Category {
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('ERR_CATEGORY_NAME_CANNOT_BE_EMPTY');
    }
    if (props.minLevel < 0) {
      throw new Error('ERR_CATEGORY_MIN_LEVEL_CANNOT_BE_NEGATIVE');
    }
    return new Category(props);
  }

  // --- Accessors ---

  public get id(): string { return this.props.id; }
  public get name(): string { return this.props.name; }
  public get description(): string | null { return this.props.description; }
  public get sortOrder(): number { return this.props.sortOrder; }
  public get minLevel(): number { return this.props.minLevel; }
  public get moderatorIds(): string[] { return [...this.props.moderatorIds]; }
  public get createdAt(): Date { return this.props.createdAt; }

  // --- Domain Behaviors ---

  /**
   * 函数名称：updateDetails
   *
   * 函数作用：
   *   更新分类的核心信息（名称、描述、排序）。校验新名称不为空。
   * Purpose:
   *   Updates the category's core details (name, description, sort order). Validates the new name is not empty.
   *
   * 调用方 / Called by:
   *   CommunityApplicationService.updateCategory
   *
   * 参数说明 / Parameters:
   *   - name: string, 新分类名称（不能为空）
   *   - description: string | null, 新描述
   *   - sortOrder: number, 新排序顺序
   *
   * 错误处理 / Error handling:
   *   - ERR_CATEGORY_NAME_CANNOT_BE_EMPTY（名称为空）
   *
   * 中文关键词：
   *   更新，分类详情，名称，描述，排序
   * English keywords:
   *   update, category details, name, description, sort
   */
  public updateDetails(name: string, description: string | null, sortOrder: number): void {
    if (!name || name.trim().length === 0) {
      throw new Error('ERR_CATEGORY_NAME_CANNOT_BE_EMPTY');
    }
    this.props.name = name.trim();
    this.props.description = description;
    this.props.sortOrder = sortOrder;
  }

  /**
   * 函数名称：changeMinLevel
   *
   * 函数作用：
   *   修改分类的最低发帖等级要求。
   * Purpose:
   *   Changes the minimum user level required to post in this category.
   *
   * 调用方 / Called by:
   *   CommunityApplicationService.updateCategory
   *
   * 参数说明 / Parameters:
   *   - level: number, 新最小等级（不能为负）
   *
   * 错误处理 / Error handling:
   *   - ERR_CATEGORY_MIN_LEVEL_CANNOT_BE_NEGATIVE
   *
   * 中文关键词：
   变更，最低等级，分类限制
   * English keywords:
   *   change, min level, category constraint
   */
  public changeMinLevel(level: number): void {
    if (level < 0) {
      throw new Error('ERR_CATEGORY_MIN_LEVEL_CANNOT_BE_NEGATIVE');
    }
    this.props.minLevel = level;
  }

  /**
   * 函数名称：isLevelSufficient
   *
   * 函数作用：
   *   判断用户等级是否满足本分类的发布/回复要求。
   * Purpose:
   *   Checks whether a user level meets this category's posting/replying requirement.
   *
   * 调用方 / Called by:
   *   CommunityApplicationService.createPost / createComment
   *
   * 参数说明 / Parameters:
   *   - userLevel: number, 用户等级
   *
   * 返回值说明 / Returns:
   *   boolean，等级足够返回 true
   *
   * 中文关键词：
   等级判断，分类权限
   * English keywords:
   *   level check, category access
   */
  public isLevelSufficient(userLevel: number): boolean {
    return userLevel >= this.props.minLevel;
  }

  /**
   * 函数名称：addModerator
   *
   * 函数作用：
   *   添加版主到分类的版主列表。
   * Purpose:
   *   Adds a moderator to the category's moderator list.
   *
   * 调用方 / Called by:
   *   CommunityApplicationService.assignCategoryModerator
   *
   * 参数说明 / Parameters:
   *   - userId: string, 要添加的用户 ID
   *
   * 中文关键词：
   添加版主，分类
   * English keywords:
   *   add moderator, category
   */
  public addModerator(userId: string): void {
    if (!this.props.moderatorIds.includes(userId)) {
      this.props.moderatorIds.push(userId);
    }
  }

  /**
   * 函数名称：removeModerator
   *
   * 函数作用：
   *   从分类的版主列表中移除指定用户。
   * Purpose:
   *   Removes a moderator from the category's moderator list.
   *
   * 调用方 / Called by:
   *   CommunityApplicationService.removeCategoryModerator
   *
   * 参数说明 / Parameters:
   *   - userId: string, 要移除的用户 ID
   *
   * 中文关键词：
   移除版主，分类
   * English keywords:
   *   remove moderator, category
   */
  public removeModerator(userId: string): void {
    this.props.moderatorIds = this.props.moderatorIds.filter(id => id !== userId);
  }
}
export interface CategoryProps {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  minLevel: number;
  createdAt: Date;
}

/**
 * Callers: [PrismaCategoryRepository, CommunityApplicationService]
 * Callees: []
 * Description: Represents the Category Aggregate Root within the Community domain. Encapsulates forum section invariants like minimum level requirements.
 * Keywords: category, aggregate, root, domain, entity, forum, community
 */
export class Category {
  private props: CategoryProps;

  /**
   * Callers: [Category.create, PrismaCategoryRepository.toDomain]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, category, entity, instantiation
   */
  private constructor(props: CategoryProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [PrismaCategoryRepository, CommunityApplicationService]
   * Callees: [Category.constructor]
   * Description: Static factory method creating a new Category entity after validating that its name is not empty.
   * Keywords: create, factory, category, domain, instantiation
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
  public get createdAt(): Date { return this.props.createdAt; }

  // --- Domain Behaviors ---

  /**
   * Callers: [CommunityApplicationService.updateCategory]
   * Callees: []
   * Description: Updates the category's core details and validates the new name.
   * Keywords: update, category, name, description, sort
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
   * Callers: [CommunityApplicationService.updateCategory]
   * Callees: []
   * Description: Changes the minimum user level required to post in this category.
   * Keywords: change, minimum, level, category, requirement
   */
  public changeMinLevel(level: number): void {
    if (level < 0) {
      throw new Error('ERR_CATEGORY_MIN_LEVEL_CANNOT_BE_NEGATIVE');
    }
    this.props.minLevel = level;
  }

  /**
   * Callers: [CommunityApplicationService.createPost, CommunityApplicationService.createComment]
   * Callees: []
   * Description: Verifies whether a given user level is sufficient to interact with this category.
   * Keywords: verify, level, requirement, category, interaction
   */
  public isLevelSufficient(userLevel: number): boolean {
    return userLevel >= this.props.minLevel;
  }
}
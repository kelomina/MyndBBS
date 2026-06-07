export enum WikiStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

export interface WikiProps {
  id: string;
  title: string;
  description: string;
  coverUrl: string | null;
  ownerId: string;
  minReadLevel: number;
  minEditLevel: number;
  isPublic: boolean;
  status: WikiStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateWikiProps = Omit<WikiProps, 'status' | 'createdAt' | 'updatedAt'>;

/**
 * Callers: [PrismaWikiRepository, WikiApplicationService]
 * Callees: []
 * Description: Represents the Wiki Aggregate Root. Manages Wiki state and collaborators.
 * Keywords: wiki, aggregate, root, domain, entity
 */
export class Wiki {
  private props: WikiProps;

  /**
   * Callers: [Wiki.create, Wiki.load, PrismaWikiRepository.toDomain]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, wiki, entity, instantiation
   */
  private constructor(props: WikiProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [WikiApplicationService]
   * Callees: [Wiki.constructor]
   * Description: Static factory method creating a new Wiki entity. Validates basic requirements.
   * Keywords: create, factory, wiki, domain, instantiation
   */
  public static create(props: CreateWikiProps): Wiki {
    if (!props.title || props.title.trim().length === 0) {
      throw new Error('ERR_WIKI_TITLE_CANNOT_BE_EMPTY');
    }
    if (!props.description || props.description.trim().length === 0) {
      throw new Error('ERR_WIKI_DESCRIPTION_CANNOT_BE_EMPTY');
    }

    return new Wiki({
      ...props,
      status: WikiStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Callers: [PrismaWikiRepository]
   * Callees: [Wiki.constructor]
   * Description: Reconstitutes a Wiki entity from persistence without applying creation domain rules.
   * Keywords: load, reconstitute, wiki, domain, persistence
   */
  public static load(props: WikiProps): Wiki {
    return new Wiki(props);
  }

  // --- Accessors ---

  public get id(): string { return this.props.id; }
  public get title(): string { return this.props.title; }
  public get description(): string { return this.props.description; }
  public get coverUrl(): string | null { return this.props.coverUrl; }
  public get ownerId(): string { return this.props.ownerId; }
  public get minReadLevel(): number { return this.props.minReadLevel; }
  public get minEditLevel(): number { return this.props.minEditLevel; }
  public get isPublic(): boolean { return this.props.isPublic; }
  public get status(): WikiStatus { return this.props.status; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }

  // --- Domain Behaviors ---

  /**
   * Callers: [WikiApplicationService]
   * Callees: []
   * Description: Updates Wiki basic information.
   * Keywords: update, wiki, details
   */
  public updateDetails(title: string, description: string, coverUrl: string | null): void {
    if (title && title.trim().length > 0) this.props.title = title.trim();
    if (description && description.trim().length > 0) this.props.description = description.trim();
    if (coverUrl !== undefined) this.props.coverUrl = coverUrl;
    this.props.updatedAt = new Date();
  }

  /**
   * Callers: [WikiApplicationService]
   * Callees: []
   * Description: Updates Wiki permission settings.
   * Keywords: update, wiki, permissions
   */
  public updatePermissions(minReadLevel: number, minEditLevel: number, isPublic: boolean): void {
    this.props.minReadLevel = minReadLevel;
    this.props.minEditLevel = minEditLevel;
    this.props.isPublic = isPublic;
    this.props.updatedAt = new Date();
  }

  /**
   * Callers: [WikiApplicationService]
   * Callees: []
   * Description: Archives the Wiki.
   * Keywords: archive, wiki
   */
  public archive(): void {
    if (this.props.status === WikiStatus.DELETED) {
      throw new Error('ERR_WIKI_ALREADY_DELETED');
    }
    this.props.status = WikiStatus.ARCHIVED;
    this.props.updatedAt = new Date();
  }

  /**
   * Callers: [WikiApplicationService]
   * Callees: []
   * Description: Restores an archived Wiki.
   * Keywords: restore, wiki
   */
  public restore(): void {
    if (this.props.status !== WikiStatus.ARCHIVED) {
      throw new Error('ERR_WIKI_NOT_ARCHIVED');
    }
    this.props.status = WikiStatus.ACTIVE;
    this.props.updatedAt = new Date();
  }

  /**
   * Callers: [WikiApplicationService]
   * Callees: []
   * Description: Soft deletes the Wiki.
   * Keywords: delete, wiki, soft delete
   */
  public delete(): void {
    this.props.status = WikiStatus.DELETED;
    this.props.updatedAt = new Date();
  }

  public toJSON(): Record<string, unknown> {
    return { ...this.props };
  }
}

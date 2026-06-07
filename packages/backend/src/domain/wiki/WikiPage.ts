export enum PageStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

export interface WikiPageProps {
  id: string;
  wikiId: string;
  slug: string;
  title: string;
  content: string;
  parentId: string | null;
  authorId: string;
  lastEditorId: string | null;
  sortOrder: number;
  status: PageStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateWikiPageProps = Omit<WikiPageProps, 'status' | 'createdAt' | 'updatedAt' | 'lastEditorId'>;

/**
 * Callers: [PrismaWikiPageRepository, WikiPageApplicationService]
 * Callees: []
 * Description: Represents a Wiki Page entity. Manages page content and history.
 * Keywords: wiki, page, entity, domain
 */
export class WikiPage {
  private props: WikiPageProps;

  /**
   * Callers: [WikiPage.create, WikiPage.load, PrismaWikiPageRepository.toDomain]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, wiki page, entity, instantiation
   */
  private constructor(props: WikiPageProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [WikiPageApplicationService]
   * Callees: [WikiPage.constructor]
   * Description: Static factory method creating a new Wiki Page entity. Validates basic requirements.
   * Keywords: create, factory, wiki page, domain, instantiation
   */
  public static create(props: CreateWikiPageProps): WikiPage {
    if (!props.title || props.title.trim().length === 0) {
      throw new Error('ERR_WIKI_PAGE_TITLE_CANNOT_BE_EMPTY');
    }
    if (!props.slug || props.slug.trim().length === 0) {
      throw new Error('ERR_WIKI_PAGE_SLUG_CANNOT_BE_EMPTY');
    }
    if (!props.content || props.content.trim().length === 0) {
      throw new Error('ERR_WIKI_PAGE_CONTENT_CANNOT_BE_EMPTY');
    }

    return new WikiPage({
      ...props,
      lastEditorId: props.authorId,
      status: PageStatus.PUBLISHED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Callers: [PrismaWikiPageRepository]
   * Callees: [WikiPage.constructor]
   * Description: Reconstitutes a Wiki Page entity from persistence.
   * Keywords: load, reconstitute, wiki page, domain, persistence
   */
  public static load(props: WikiPageProps): WikiPage {
    return new WikiPage(props);
  }

  // --- Accessors ---

  public get id(): string { return this.props.id; }
  public get wikiId(): string { return this.props.wikiId; }
  public get slug(): string { return this.props.slug; }
  public get title(): string { return this.props.title; }
  public get content(): string { return this.props.content; }
  public get parentId(): string | null { return this.props.parentId; }
  public get authorId(): string { return this.props.authorId; }
  public get lastEditorId(): string | null { return this.props.lastEditorId; }
  public get sortOrder(): number { return this.props.sortOrder; }
  public get status(): PageStatus { return this.props.status; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }

  // --- Domain Behaviors ---

  /**
   * Callers: [WikiPageApplicationService]
   * Callees: []
   * Description: Updates Wiki Page content, updating last editor.
   * Keywords: update, wiki page, content
   */
  public updateContent(title: string, content: string, slug: string, lastEditorId: string): void {
    if (title && title.trim().length > 0) this.props.title = title.trim();
    if (content && content.trim().length > 0) this.props.content = content.trim();
    if (slug && slug.trim().length > 0) this.props.slug = slug.trim();
    this.props.lastEditorId = lastEditorId;
    this.props.updatedAt = new Date();
  }

  /**
   * Callers: [WikiPageApplicationService]
   * Callees: []
   * Description: Moves Wiki Page to a new parent or position.
   * Keywords: move, wiki page, parent, sort order
   */
  public move(parentId: string | null, sortOrder: number): void {
    this.props.parentId = parentId;
    this.props.sortOrder = sortOrder;
    this.props.updatedAt = new Date();
  }

  /**
   * Callers: [WikiPageApplicationService]
   * Callees: []
   * Description: Publishes a draft Wiki Page.
   * Keywords: publish, wiki page
   */
  public publish(): void {
    if (this.props.status !== PageStatus.DRAFT) {
      throw new Error('ERR_WIKI_PAGE_NOT_DRAFT');
    }
    this.props.status = PageStatus.PUBLISHED;
    this.props.updatedAt = new Date();
  }

  /**
   * Callers: [WikiPageApplicationService]
   * Callees: []
   * Description: Archives the Wiki Page.
   * Keywords: archive, wiki page
   */
  public archive(): void {
    if (this.props.status === PageStatus.DELETED) {
      throw new Error('ERR_WIKI_PAGE_ALREADY_DELETED');
    }
    this.props.status = PageStatus.ARCHIVED;
    this.props.updatedAt = new Date();
  }

  /**
   * Callers: [WikiPageApplicationService]
   * Callees: []
   * Description: Restores an archived Wiki Page.
   * Keywords: restore, wiki page
   */
  public restore(): void {
    if (this.props.status !== PageStatus.ARCHIVED) {
      throw new Error('ERR_WIKI_PAGE_NOT_ARCHIVED');
    }
    this.props.status = PageStatus.PUBLISHED;
    this.props.updatedAt = new Date();
  }

  /**
   * Callers: [WikiPageApplicationService]
   * Callees: []
   * Description: Soft deletes the Wiki Page.
   * Keywords: delete, wiki page, soft delete
   */
  public delete(): void {
    this.props.status = PageStatus.DELETED;
    this.props.updatedAt = new Date();
  }

  public toJSON(): Record<string, unknown> {
    return { ...this.props };
  }
}

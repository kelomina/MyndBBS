export enum CollaboratorRole {
  VIEW = 'VIEW',
  EDIT = 'EDIT',
  ADMIN = 'ADMIN',
}

export interface WikiCollaboratorProps {
  id: string;
  wikiId: string;
  userId: string;
  role: CollaboratorRole;
  addedAt: Date;
}

export type CreateWikiCollaboratorProps = Omit<WikiCollaboratorProps, 'addedAt'>;

/**
 * Callers: [PrismaWikiCollaboratorRepository, WikiApplicationService]
 * Callees: []
 * Description: Represents a Wiki Collaborator entity. Manages collaborator permissions.
 * Keywords: wiki, collaborator, entity, domain
 */
export class WikiCollaborator {
  private props: WikiCollaboratorProps;

  /**
   * Callers: [WikiCollaborator.create, WikiCollaborator.load, PrismaWikiCollaboratorRepository.toDomain]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, wiki collaborator, entity, instantiation
   */
  private constructor(props: WikiCollaboratorProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [WikiApplicationService]
   * Callees: [WikiCollaborator.constructor]
   * Description: Static factory method creating a new Wiki Collaborator entity.
   * Keywords: create, factory, wiki collaborator, domain, instantiation
   */
  public static create(props: CreateWikiCollaboratorProps): WikiCollaborator {
    return new WikiCollaborator({
      ...props,
      addedAt: new Date(),
    });
  }

  /**
   * Callers: [PrismaWikiCollaboratorRepository]
   * Callees: [WikiCollaborator.constructor]
   * Description: Reconstitutes a Wiki Collaborator entity from persistence.
   * Keywords: load, reconstitute, wiki collaborator, domain, persistence
   */
  public static load(props: WikiCollaboratorProps): WikiCollaborator {
    return new WikiCollaborator(props);
  }

  // --- Accessors ---

  public get id(): string { return this.props.id; }
  public get wikiId(): string { return this.props.wikiId; }
  public get userId(): string { return this.props.userId; }
  public get role(): CollaboratorRole { return this.props.role; }
  public get addedAt(): Date { return this.props.addedAt; }

  // --- Domain Behaviors ---

  /**
   * Callers: [WikiApplicationService]
   * Callees: []
   * Description: Updates collaborator's role.
   * Keywords: update, role, collaborator
   */
  public updateRole(role: CollaboratorRole): void {
    this.props.role = role;
  }

  public toJSON(): Record<string, unknown> {
    return { ...this.props };
  }
}

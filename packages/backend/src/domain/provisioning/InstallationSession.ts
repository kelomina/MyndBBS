export interface InstallationSessionProps {
  id: string;
  createdAt: Date;
  isCompleted: boolean;
}

/**
 * Callers: [InstallationApplicationService]
 * Callees: []
 * Description: Domain entity representing an installation session.
 * Keywords: installation, session, provisioning, entity
 */
export class InstallationSession {
  private props: InstallationSessionProps;

  /**
   * Callers: [InstallationSession.create, InstallationSession.load]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, installation, session, instantiation
   */
  private constructor(props: InstallationSessionProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [InMemoryInstallationSessionRepository]
   * Callees: [InstallationSession.constructor]
   * Description: Static factory method creating a new InstallationSession entity.
   * Keywords: create, factory, installation, session, instantiation
   */
  public static create(props: InstallationSessionProps): InstallationSession {
    if (!props.id) {
      throw new Error('ERR_INSTALLATION_SESSION_MISSING_ID');
    }
    return new InstallationSession(props);
  }

  /**
   * Callers: []
   * Callees: [InstallationSession.constructor]
   * Description: Static factory method reconstituting an InstallationSession entity from database state.
   * Keywords: load, factory, installation, session, reconstitute
   */
  public static load(props: InstallationSessionProps): InstallationSession {
    return new InstallationSession(props);
  }

  public get id(): string { return this.props.id; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get isCompleted(): boolean { return this.props.isCompleted; }

  /**
   * Callers: [InMemoryInstallationSessionRepository]
   * Callees: []
   * Description: Marks the installation session as completed.
   * Keywords: mark, complete, installation, session
   */
  public markCompleted(): void {
    if (this.props.isCompleted) {
      throw new Error('ERR_INSTALLATION_SESSION_ALREADY_COMPLETED');
    }
    this.props.isCompleted = true;
  }
}

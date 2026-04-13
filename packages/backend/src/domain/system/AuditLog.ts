export interface AuditLogProps {
  id: string;
  who: string;
  action: string;
  target: string;
  timestamp: Date;
}

/**
 * Callers: [PrismaAuditLogRepository, logAudit]
 * Callees: []
 * Description: Represents the AuditLog Aggregate Root within the System domain. Serves as an immutable record of a system action.
 * Keywords: auditlog, aggregate, root, domain, entity, system, logging, immutable
 */
export class AuditLog {
  private props: AuditLogProps;

  /**
   * Callers: [AuditLog.create, PrismaAuditLogRepository.toDomain]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, auditlog, entity, instantiation
   */
  private constructor(props: AuditLogProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [PrismaAuditLogRepository, logAudit]
   * Callees: [AuditLog.constructor]
   * Description: Static factory method creating a new AuditLog entity. Validates essential components.
   * Keywords: create, factory, auditlog, domain, instantiation
   */
  public static create(props: AuditLogProps): AuditLog {
    if (!props.who || !props.action || !props.target) {
      throw new Error('ERR_AUDIT_LOG_MISSING_REQUIRED_FIELDS');
    }
    return new AuditLog(props);
  }

  /**
   * Callers: [PrismaAuditLogRepository]
   * Callees: [AuditLog.constructor]
   * Description: Static factory method reconstituting an AuditLog entity from database state.
   * Keywords: load, factory, auditlog, domain, reconstitute
   */
  public static load(props: AuditLogProps): AuditLog {
    return new AuditLog(props);
  }

  // --- Accessors ---

  public get id(): string { return this.props.id; }
  public get who(): string { return this.props.who; }
  public get action(): string { return this.props.action; }
  public get target(): string { return this.props.target; }
  public get timestamp(): Date { return this.props.timestamp; }

  // Note: An AuditLog is inherently immutable, so it exposes no update behaviors.
}
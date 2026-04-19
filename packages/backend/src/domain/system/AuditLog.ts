export interface AuditLogProps {
  id: string;
  operatorId: string;
  permissionGroup: string;
  operationType: string;
  requestPath: string;
  payload: Record<string, any>;
  ip: string;
  createdAt: Date;
}

/**
 * Callers: [PrismaAuditLogRepository, AuditApplicationService]
 * Callees: []
 * Description: Represents the AuditLog Aggregate Root within the System domain. Serves as an immutable record of an admin system action.
 * Keywords: auditlog, aggregate, root, domain, entity, system, logging, immutable, operator, permission
 */
export class AuditLog {
  private props: AuditLogProps;

  /**
   * Callers: [AuditLog.create, AuditLog.load]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, auditlog, entity, instantiation
   */
  private constructor(props: AuditLogProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [AuditApplicationService]
   * Callees: [AuditLog.constructor]
   * Description: Static factory method creating a new AuditLog entity. Validates essential components.
   * Keywords: create, factory, auditlog, domain, instantiation
   */
  public static create(props: AuditLogProps): AuditLog {
    if (!props.operatorId || !props.permissionGroup || !props.operationType || !props.requestPath || !props.ip) {
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
  public get operatorId(): string { return this.props.operatorId; }
  public get permissionGroup(): string { return this.props.permissionGroup; }
  public get operationType(): string { return this.props.operationType; }
  public get requestPath(): string { return this.props.requestPath; }
  public get payload(): Record<string, any> { return this.props.payload; }
  public get ip(): string { return this.props.ip; }
  public get createdAt(): Date { return this.props.createdAt; }

  // Note: An AuditLog is inherently immutable, so it exposes no update behaviors.
}

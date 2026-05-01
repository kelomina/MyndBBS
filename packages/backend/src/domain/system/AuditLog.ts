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
 * 类名称：AuditLog
 *
 * 函数作用：
 *   系统域中的审计日志聚合根。作为管理员系统操作的不可变记录。
 * Purpose:
 *   AuditLog Aggregate Root in the System domain. Immutable record of an admin system action.
 *
 * 调用方 / Called by:
 *   - PrismaAuditLogRepository
 *   - AuditApplicationService
 *
 * 中文关键词：
 *   审计日志，聚合根，不可变记录
 * English keywords:
 *   audit log, aggregate root, immutable record
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
   * 函数名称：create
   *
   * 函数作用：
   *   静态工厂方法——创建新的审计日志。校验所有必填字段。
   * Purpose:
   *   Static factory method — creates a new AuditLog. Validates all required fields.
   *
   * 调用方 / Called by:
   *   AuditApplicationService.logAudit
   *
   * 参数说明 / Parameters:
   *   - props: AuditLogProps（operatorId、permissionGroup、operationType、requestPath、ip 必填）
   *
   * 错误处理 / Error handling:
   *   - ERR_AUDIT_LOG_MISSING_REQUIRED_FIELDS
   *
   * 中文关键词：
   创建审计日志，工厂方法
   * English keywords:
   *   create audit log, factory method
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

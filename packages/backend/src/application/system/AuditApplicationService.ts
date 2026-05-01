import { IAuditLogRepository } from '../../domain/system/IAuditLogRepository';
import { AuditLog } from '../../domain/system/AuditLog';
import { randomUUID as uuidv4 } from 'crypto';
import { IUnitOfWork } from '../../domain/shared/IUnitOfWork';

/**
 * 类名称：AuditApplicationService
 *
 * 函数作用：
 *   审计日志应用服务——安全地记录和查询审计事件。
 * Purpose:
 *   Audit log application service — securely records and queries audit events.
 *
 * 调用方 / Called by:
 *   - adminController（兜底审计）
 *   - ModerationApplicationService（内容审核操作）
 *   - 其他应用服务
 *
 * 中文关键词：
 *   审计，日志，应用服务
 * English keywords:
 *   audit, log, application service
 */
export class AuditApplicationService {
  /**
   * 函数名称：constructor
   *
   * 函数作用：
   *   通过依赖注入初始化审计服务。
   * Purpose:
   *   Initializes the audit service with dependency injection.
   */
  constructor(
    private auditLogRepository: IAuditLogRepository,
    private unitOfWork: IUnitOfWork
  ) {}

  /**
   * 函数名称：maskSensitiveData
   *
   * 函数作用：
   *   在审计日志中脱敏敏感数据（邮箱、令牌、JWT、密码等）。
   * Purpose:
   *   Masks sensitive data in audit logs (emails, tokens, JWTs, passwords, etc.).
   *
   * 调用方 / Called by:
   *   - logAudit
   *
   * 参数说明 / Parameters:
   *   - data: string, 原始文本
   *
   * 返回值说明 / Returns:
   *   string 脱敏后的文本
   *
   * 中文关键词：
   *   脱敏，审计，邮箱，令牌，密码
   * English keywords:
   *   sanitize, audit, email, token, password
   */
  private maskSensitiveData(data: string) {
    return data
      .replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi, '***@***.***')
      .replace(/(token|password|secret|code)[=:]\s*([^&\s]+)/gi, '$1=***')
      .replace(/(eyJ[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,})/gi, '***');
  }

  /**
   * 函数名称：logAudit
   *
   * 函数作用：
   *   记录审计事件到数据库，自动对敏感数据进行脱敏处理。
   *   审计写入失败仅记录错误日志，不阻断主业务流程。
   * Purpose:
   *   Records an audit event to the database with automatic sensitive data masking.
   *   Audit write failures are logged but do not block the main business flow.
   *
   * 调用方 / Called by:
   *   - ModerationApplicationService
   *   - middleware/audit.ts（兜底审计）
   *   - 其他应用服务
   *
   * 被调用方 / Calls:
   *   - maskSensitiveData
   *   - unitOfWork.execute
   *   - auditLogRepository.save
   *
   * 参数说明 / Parameters:
   *   - operatorId: string, 操作者 ID
   *   - operationType: string, 操作类型（如 'APPROVE_POST'）
   *   - target: string, 操作目标描述
   *   - permissionGroup: string, 权限组（默认 'SYSTEM'）
   *   - requestPath: string, 请求路径（默认 '/system/event'）
   *   - ip: string, 操作者 IP（默认 '127.0.0.1'）
   *   - payload: Record<string, any>, 附加上下文（默认 {}）
   *
   * 返回值说明 / Returns:
   *   Promise<void>
   *
   * 副作用 / Side effects:
   *   写数据库——创建审计日志记录
   *
   * 事务边界 / Transaction:
   *   内部通过 UnitOfWork 管理事务
   *
   * 中文关键词：
   *   记录审计，脱敏，操作类型
   * English keywords:
   *   log audit, sanitize, operation type
   */
  public async logAudit(
    operatorId: string,
    operationType: string,
    target: string,
    permissionGroup: string = 'SYSTEM',
    requestPath: string = '/system/event',
    ip: string = '127.0.0.1',
    payload: Record<string, any> = {}
  ): Promise<void> {
    try {
      await this.unitOfWork.execute(async () => {
        const auditLog = AuditLog.create({
          id: uuidv4(),
          operatorId: this.maskSensitiveData(operatorId),
          permissionGroup,
          operationType: this.maskSensitiveData(operationType),
          requestPath,
          payload: { target: this.maskSensitiveData(target), ...payload },
          ip,
          createdAt: new Date()
        });
        await this.auditLogRepository.save(auditLog);
      });
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  /**
   * Retrieves a paginated list of audit logs.
   * @param params The pagination and filtering parameters
   * @returns A paginated result containing items and the total count
   */
  public async getPaginatedLogs(params: {
    skip?: number;
    take?: number;
    operatorId?: string;
    operationType?: string;
  }): Promise<{ items: AuditLog[]; total: number }> {
    return this.auditLogRepository.findMany(params);
  }

  /**
   * Deletes audit logs older than the specified number of days.
   * @param retentionDays Keep logs from the last N days, delete older entries.
   * @returns Number of deleted records.
   */
  public async cleanupOldLogs(retentionDays: number = 90): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    return this.auditLogRepository.deleteOlderThan(cutoff);
  }
}

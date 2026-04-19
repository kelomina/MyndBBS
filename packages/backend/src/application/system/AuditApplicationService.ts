import { IAuditLogRepository } from '../../domain/system/IAuditLogRepository';
import { AuditLog } from '../../domain/system/AuditLog';
import { randomUUID as uuidv4 } from 'crypto';
import { IUnitOfWork } from '../../domain/shared/IUnitOfWork';

/**
 * Callers: [SystemApplicationService, UserApplicationService, etc.]
 * Callees: [IAuditLogRepository.save, IUnitOfWork.execute]
 * Description: The Application Service for the Audit Domain. Handles logging audit events securely.
 * Keywords: audit, log, service, application, security
 */
export class AuditApplicationService {
  /**
   * Initializes the service with the AuditLog repository and Unit of Work.
   * @param auditLogRepository The repository for audit logs
   * @param unitOfWork The unit of work for transaction management
   */
  constructor(
    private auditLogRepository: IAuditLogRepository,
    private unitOfWork: IUnitOfWork
  ) {}

  /**
   * Masks sensitive data like emails, tokens, and JWTs in the audit logs.
   * @param data The raw string data
   * @returns The masked string
   */
  private maskSensitiveData(data: string) {
    return data
      .replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi, '***@***.***')
      .replace(/(token|password|secret|code)[=:]\s*([^&\s]+)/gi, '$1=***')
      .replace(/(eyJ[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,})/gi, '***');
  }

  /**
   * Logs an audit event to the repository using a unit of work.
   * @param operatorId The identifier of the user performing the action
   * @param operationType The action being performed
   * @param target The target of the action
   * @param permissionGroup The permission group of the operator
   * @param requestPath The API path that triggered the action
   * @param ip The IP address of the operator
   * @param payload Additional context
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
}

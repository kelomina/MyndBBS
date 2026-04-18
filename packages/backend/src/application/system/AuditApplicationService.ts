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
   * @param who The identifier of the user performing the action
   * @param action The action being performed
   * @param target The target of the action
   */
  public async logAudit(who: string, action: string, target: string): Promise<void> {
    try {
      await this.unitOfWork.execute(async () => {
        const auditLog = AuditLog.create({
          id: uuidv4(),
          who: this.maskSensitiveData(who),
          action: this.maskSensitiveData(action),
          target: this.maskSensitiveData(target),
          timestamp: new Date()
        });
        await this.auditLogRepository.save(auditLog);
      });
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }
}

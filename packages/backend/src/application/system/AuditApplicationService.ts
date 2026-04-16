import { IAuditLogRepository } from '../../domain/system/IAuditLogRepository';
import { AuditLog } from '../../domain/system/AuditLog';
import { randomUUID as uuidv4 } from 'crypto';

export class AuditApplicationService {
  constructor(private auditLogRepository: IAuditLogRepository) {}

  private maskSensitiveData(data: string) {
    return data
      .replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi, '***@***.***')
      .replace(/(token|password|secret|code)[=:]\s*([^&\s]+)/gi, '$1=***')
      .replace(/(eyJ[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,})/gi, '***');
  }

  public async logAudit(who: string, action: string, target: string): Promise<void> {
    try {
      const auditLog = AuditLog.create({
        id: uuidv4(),
        who: this.maskSensitiveData(who),
        action: this.maskSensitiveData(action),
        target: this.maskSensitiveData(target),
        timestamp: new Date()
      });
      await this.auditLogRepository.save(auditLog);
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }
}

import { AuditLog } from './AuditLog';

/**
 * Callers: [logAudit]
 * Callees: []
 * Description: The repository interface for managing the persistence of AuditLog Aggregates.
 * Keywords: auditlog, repository, interface, contract, domain, system
 */
export interface IAuditLogRepository {
  findById(id: string): Promise<AuditLog | null>;
  save(auditLog: AuditLog): Promise<void>;
}

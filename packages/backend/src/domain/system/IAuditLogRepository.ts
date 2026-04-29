import { AuditLog } from './AuditLog';

/**
 * Callers: [AuditApplicationService]
 * Callees: []
 * Description: The repository interface for managing the persistence of AuditLog Aggregates.
 * Keywords: auditlog, repository, interface, contract, domain, system
 */
export interface IAuditLogRepository {
  /**
   * Retrieves an AuditLog by its unique identifier.
   */
  findById(id: string): Promise<AuditLog | null>;

  /**
   * Retrieves a paginated list of AuditLogs, optionally filtered by operatorId or operationType.
   */
  findMany(params: {
    skip?: number;
    take?: number;
    operatorId?: string;
    operationType?: string;
  }): Promise<{ items: AuditLog[]; total: number }>;

  /**
   * Persists an AuditLog entity to the database.
   */
  save(auditLog: AuditLog): Promise<void>;

  /**
   * Deletes all audit logs created before the given cutoff date.
   * Used for scheduled log cleanup / retention policy.
   * @param cutoffDate Delete logs with createdAt older than this date.
   * @returns Number of deleted records.
   */
  deleteOlderThan(cutoffDate: Date): Promise<number>;
}

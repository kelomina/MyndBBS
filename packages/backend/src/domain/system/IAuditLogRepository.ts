import { AuditLog } from './AuditLog';

/**
 * 接口名称：IAuditLogRepository
 *
 * 函数作用：
 *   审计日志聚合的仓储接口——定义审计日志持久化的契约。
 * Purpose:
 *   Repository interface for AuditLog aggregates — defines the persistence contract.
 *
 * 中文关键词：
 *   审计日志，仓储接口，持久化
 * English keywords:
 *   audit log, repository interface, persistence
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

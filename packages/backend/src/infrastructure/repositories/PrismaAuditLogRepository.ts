/**
 * 类名称：PrismaAuditLogRepository
 *
 * 函数作用：
 *   Prisma 实现的审计日志仓储。
 * Purpose:
 *   Prisma-based audit log repository.
 *
 * 中文关键词：
 *   Prisma，审计日志，仓储
 * English keywords:
 *   Prisma, audit log, repository
 */
import { IAuditLogRepository } from '../../domain/system/IAuditLogRepository';
import { AuditLog, AuditLogProps } from '../../domain/system/AuditLog';
import { prisma } from '../../db';

export class PrismaAuditLogRepository implements IAuditLogRepository {
  private toDomain(raw: any): AuditLog {
    const props: AuditLogProps = {
      id: raw.id,
      operatorId: raw.operatorId,
      permissionGroup: raw.permissionGroup,
      operationType: raw.operationType,
      requestPath: raw.requestPath,
      payload: typeof raw.payload === 'string' ? JSON.parse(raw.payload) : raw.payload,
      ip: raw.ip,
      createdAt: raw.createdAt,
    };
    return AuditLog.load(props);
  }

  /** 按 ID 查找审计日志 / Finds an audit log by ID */
  public async findById(id: string): Promise<AuditLog | null> {
    const raw = await prisma.auditLog.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  /**
   * 函数名称：findMany
   *
   * 函数作用：
   *   分页查询审计日志，支持按操作者和操作类型过滤。
   * Purpose:
   *   Paginated audit log query with optional operator/operation type filtering.
   */
  public async findMany(params: {
    skip?: number;
    take?: number;
    operatorId?: string;
    operationType?: string;
  }): Promise<{ items: AuditLog[]; total: number }> {
    const { skip, take, operatorId, operationType } = params;
    const where: any = {};
    if (operatorId) where.operatorId = operatorId;
    if (operationType) where.operationType = operationType;

    const queryArgs: any = {
      where,
      orderBy: { createdAt: 'desc' },
    };
    if (skip !== undefined) queryArgs.skip = skip;
    if (take !== undefined) queryArgs.take = take;

    const [rawItems, total] = await Promise.all([
      prisma.auditLog.findMany(queryArgs),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items: rawItems.map((raw) => this.toDomain(raw)),
      total,
    };
  }

  public async save(auditLog: AuditLog): Promise<void> {
    await prisma.auditLog.create({
      data: {
        id: auditLog.id,
        operatorId: auditLog.operatorId,
        permissionGroup: auditLog.permissionGroup,
        operationType: auditLog.operationType,
        requestPath: auditLog.requestPath,
        payload: auditLog.payload || {},
        ip: auditLog.ip,
        createdAt: auditLog.createdAt,
      },
    });
  }

  public async deleteOlderThan(cutoffDate: Date): Promise<number> {
    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });
    return result.count;
  }
}

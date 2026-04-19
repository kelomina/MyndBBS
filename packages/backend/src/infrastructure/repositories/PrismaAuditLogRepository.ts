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

  public async findById(id: string): Promise<AuditLog | null> {
    const raw = await prisma.auditLog.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

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
}

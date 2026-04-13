import { IAuditLogRepository } from '../../domain/system/IAuditLogRepository';
import { AuditLog, AuditLogProps } from '../../domain/system/AuditLog';
import { prisma } from '../../db';

export class PrismaAuditLogRepository implements IAuditLogRepository {
  private toDomain(raw: any): AuditLog {
    const props: AuditLogProps = {
      id: raw.id,
      who: raw.who,
      action: raw.action,
      target: raw.target,
      timestamp: raw.timestamp,
    };
    return AuditLog.load(props);
  }

  public async findById(id: string): Promise<AuditLog | null> {
    const raw = await prisma.auditLog.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  public async save(auditLog: AuditLog): Promise<void> {
    await prisma.auditLog.create({
      data: {
        id: auditLog.id,
        who: auditLog.who,
        action: auditLog.action,
        target: auditLog.target,
        when: auditLog.timestamp,
      },
    });
  }
}

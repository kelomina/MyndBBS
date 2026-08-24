/**
 * 仓储实现：PrismaBannedIpRepository
 */
import { BannedIp, BannedIpProps } from '../../domain/system/BannedIp';
import { IBannedIpRepository } from '../../domain/system/IBannedIpRepository';
import { prisma } from '../../db';

export class PrismaBannedIpRepository implements IBannedIpRepository {
  private toDomain(raw: Record<string, unknown>): BannedIp {
    const props: BannedIpProps = {
      id: raw.id as string,
      ip: raw.ip as string,
      scope: raw.scope as BannedIpProps['scope'],
      reason: (raw.reason as string | null) ?? null,
      createdBy: (raw.createdBy as string | null) ?? null,
      createdAt: raw.createdAt as Date,
      expiresAt: (raw.expiresAt as Date | null) ?? null,
    };
    return BannedIp.fromPersistence(props);
  }

  public async findById(id: string): Promise<BannedIp | null> {
    const raw = await prisma.bannedIp.findUnique({ where: { id } });
    return raw ? this.toDomain(raw) : null;
  }

  public async findActiveBan(ip: string, purpose: 'LOGIN' | 'REGISTRATION'): Promise<BannedIp | null> {
    const raw = await prisma.bannedIp.findFirst({
      where: {
        ip,
        OR: [
          { scope: 'ALL' },
          ...(purpose === 'REGISTRATION' ? [{ scope: 'REGISTRATION' as const }] : []),
        ],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
      },
    });
    return raw ? this.toDomain(raw) : null;
  }

  public async listAll(): Promise<BannedIp[]> {
    const rows = await prisma.bannedIp.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((raw) => this.toDomain(raw));
  }

  public async insert(ban: BannedIp): Promise<boolean> {
    try {
      await prisma.bannedIp.create({
        data: {
          id: ban.id,
          ip: ban.ip,
          scope: ban.scope,
          reason: ban.reason,
          createdBy: ban.createdBy,
          createdAt: ban.createdAt,
          expiresAt: ban.expiresAt,
        },
      });
      return true;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        return false;
      }
      throw error;
    }
  }

  public async delete(id: string): Promise<boolean> {
    const result = await prisma.bannedIp.deleteMany({ where: { id } });
    return result.count > 0;
  }
}

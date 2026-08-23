/**
 * 仓储实现：PrismaBadgeRepository
 *
 * 函数作用：
 *   IBadgeRepository 的 Prisma 实现。借助全局 prisma 代理，
 *   在 UnitOfWork 事务内执行时自动切换到事务客户端。
 *
 * Purpose:
 *   Prisma-based implementation of the badge definition repository.
 */
import { Badge, BadgeProps } from '../../domain/badge/Badge';
import { BadgeCondition } from '../../domain/badge/BadgeCondition';
import { IBadgeRepository } from '../../domain/badge/IBadgeRepository';
import { Prisma, type Prisma as PrismaTypes } from '../../generated/prisma/client';
import { prisma } from '../../db';

export class PrismaBadgeRepository implements IBadgeRepository {
  private toDomain(raw: Record<string, unknown>): Badge {
    const props: BadgeProps = {
      id: raw.id as string,
      code: raw.code as string,
      name: raw.name as string,
      description: (raw.description as string | null) ?? null,
      icon: (raw.icon as string | null) ?? null,
      color: (raw.color as string | null) ?? null,
      type: raw.type as BadgeProps['type'],
      grantType: raw.grantType as BadgeProps['grantType'],
      condition: BadgeCondition.fromJson(raw.condition),
      isActive: raw.isActive as boolean,
      sortOrder: raw.sortOrder as number,
      createdAt: raw.createdAt as Date,
      updatedAt: raw.updatedAt as Date,
    };
    return Badge.fromPersistence(props);
  }

  public async findById(id: string): Promise<Badge | null> {
    const raw = await prisma.badge.findUnique({ where: { id } });
    return raw ? this.toDomain(raw) : null;
  }

  public async findByCode(code: string): Promise<Badge | null> {
    const raw = await prisma.badge.findUnique({ where: { code } });
    return raw ? this.toDomain(raw) : null;
  }

  public async findAll(): Promise<Badge[]> {
    const rows = await prisma.badge.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((raw) => this.toDomain(raw));
  }

  public async findAllActiveAuto(): Promise<Badge[]> {
    const rows = await prisma.badge.findMany({
      where: { isActive: true, grantType: 'AUTO' },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((raw) => this.toDomain(raw));
  }

  private conditionToJson(badge: Badge): PrismaTypes.InputJsonValue {
    return badge.condition.toJson() as PrismaTypes.InputJsonValue;
  }

  public async save(badge: Badge): Promise<void> {
    await prisma.badge.upsert({
      where: { id: badge.id },
      create: {
        id: badge.id,
        code: badge.code,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        color: badge.color,
        type: badge.type,
        grantType: badge.grantType,
        condition: this.conditionToJson(badge),
        isActive: badge.isActive,
        sortOrder: badge.sortOrder,
      },
      update: {
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        color: badge.color,
        type: badge.type,
        grantType: badge.grantType,
        condition: this.conditionToJson(badge),
        isActive: badge.isActive,
        sortOrder: badge.sortOrder,
      },
    });
  }

  public async delete(id: string): Promise<void> {
    await prisma.badge.delete({ where: { id } });
  }

  public async countHoldersGrouped(): Promise<Map<string, number>> {
    const grouped = await prisma.userBadge.groupBy({
      by: ['badgeId'],
      _count: { _all: true },
    });
    const map = new Map<string, number>();
    for (const row of grouped) {
      map.set(row.badgeId, row._count._all);
    }
    return map;
  }
}

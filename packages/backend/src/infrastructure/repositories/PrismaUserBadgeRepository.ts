/**
 * 仓储实现：PrismaUserBadgeRepository
 *
 * 函数作用：
 *   IUserBadgeRepository 的 Prisma 实现。持有记录以
 *   (userId, badgeId) 唯一约束保证幂等。
 *
 * Purpose:
 *   Prisma-based implementation of the user-badge ownership repository.
 */
import { UserBadge, UserBadgeProps } from '../../domain/badge/UserBadge';
import { IUserBadgeRepository } from '../../domain/badge/IUserBadgeRepository';
import { prisma } from '../../db';

export class PrismaUserBadgeRepository implements IUserBadgeRepository {
  private toDomain(raw: Record<string, unknown>): UserBadge {
    const props: UserBadgeProps = {
      id: raw.id as string,
      userId: raw.userId as string,
      badgeId: raw.badgeId as string,
      grantedBy: (raw.grantedBy as string | null) ?? null,
      reason: (raw.reason as string | null) ?? null,
      createdAt: raw.createdAt as Date,
    };
    return UserBadge.fromPersistence(props);
  }

  private toCreateValues(userBadge: UserBadge) {
    return {
      userId: userBadge.userId,
      badgeId: userBadge.badgeId,
      grantedBy: userBadge.grantedBy,
      reason: userBadge.reason,
    };
  }

  public async findByUserAndBadge(userId: string, badgeId: string): Promise<UserBadge | null> {
    const raw = await prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId } },
    });
    return raw ? this.toDomain(raw) : null;
  }

  public async findByUser(userId: string): Promise<UserBadge[]> {
    const rows = await prisma.userBadge.findMany({ where: { userId } });
    return rows.map((raw) => this.toDomain(raw));
  }

  public async findByBadge(badgeId: string): Promise<UserBadge[]> {
    const rows = await prisma.userBadge.findMany({
      where: { badgeId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((raw) => this.toDomain(raw));
  }

  public async findExistingKeys(badgeIds: string[]): Promise<Set<string>> {
    if (badgeIds.length === 0) return new Set();
    const rows = await prisma.userBadge.findMany({
      where: { badgeId: { in: badgeIds } },
      select: { badgeId: true, userId: true },
    });
    const keys = new Set<string>();
    for (const row of rows) {
      keys.add(`${row.badgeId}:${row.userId}`);
    }
    return keys;
  }

  public async save(userBadge: UserBadge): Promise<void> {
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId: userBadge.userId, badgeId: userBadge.badgeId } },
      create: { id: userBadge.id, ...this.toCreateValues(userBadge) },
      update: {},
    });
  }

  public async remove(userId: string, badgeId: string): Promise<boolean> {
    const result = await prisma.userBadge.deleteMany({ where: { userId, badgeId } });
    return result.count > 0;
  }
}

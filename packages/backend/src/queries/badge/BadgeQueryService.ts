/**
 * 查询服务：BadgeQueryService
 *
 * 函数作用：
 *   徽章管理后台的读侧查询（CQRS）：
 *   - listBadgeHolders：查询某徽章的持有人列表（含用户名/头像），支持按用户名搜索
 *
 * Purpose:
 *   Read-side query service for badge administration.
 */
import { prisma } from '../../db';

export interface BadgeHolderDTO {
  userId: string;
  username: string;
  avatarUrl: string | null;
  grantedBy: string | null;
  grantedByUsername: string | null;
  reason: string | null;
  grantedAt: Date;
}

export class BadgeQueryService {
  /**
   * 查询某徽章的持有人列表。query 非空时按用户名模糊过滤。
   */
  public async listBadgeHolders(badgeId: string, query?: string): Promise<BadgeHolderDTO[]> {
    const where = query
      ? {
          badgeId,
          user: { username: { contains: query, mode: 'insensitive' as const } },
        }
      : { badgeId };

    const rows = await prisma.userBadge.findMany({
      where,
      select: {
        userId: true,
        grantedBy: true,
        reason: true,
        createdAt: true,
        user: { select: { id: true, username: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // 批量解析授予人用户名
    const granterIds = [...new Set(rows.map((r) => r.grantedBy).filter((v): v is string => Boolean(v)))];
    const granters = await grantersMap(granterIds);

    return rows.map((row) => ({
      userId: row.user.id,
      username: row.user.username,
      avatarUrl: row.user.avatarUrl,
      grantedBy: row.grantedBy,
      grantedByUsername: row.grantedBy ? granters.get(row.grantedBy) ?? null : null,
      reason: row.reason,
      grantedAt: row.createdAt,
    }));
  }
}

async function grantersMap(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, username: true },
  });
  return new Map(users.map((u) => [u.id, u.username]));
}

export const badgeQueryService = new BadgeQueryService();

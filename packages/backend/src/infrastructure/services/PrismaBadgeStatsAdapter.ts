/**
 * 适配器：PrismaBadgeStatsAdapter
 *
 * 函数作用：
 *   IBadgeStatsPort 的 Prisma 实现。通过聚合查询高效计算
 *   徽章自动评估所需的统计数据（等级分布、内容计数、夜间发布计数）。
 *
 * Purpose:
 *   Prisma-based read-side adapter supplying user statistics for badge evaluation.
 */
import { Prisma } from '../../generated/prisma/client';
import { PostStatus, UserStatus } from '@myndbbs/shared';
import {
  ContentCountsByAuthor,
  IBadgeStatsPort,
} from '../../domain/badge/IBadgeStatsPort';
import { prisma } from '../../db';

export class PrismaBadgeStatsAdapter implements IBadgeStatsPort {
  public async getUserIdsWithLevelAtLeast(threshold: number): Promise<string[]> {
    const rows = await prisma.user.findMany({
      where: { level: { gte: threshold }, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  public async getContentCountsByAuthor(): Promise<ContentCountsByAuthor> {
    const [postGroups, commentGroups] = await Promise.all([
      prisma.post.groupBy({
        by: ['authorId'],
        where: { status: { in: [PostStatus.PUBLISHED, PostStatus.PINNED] } },
        _count: { _all: true },
      }),
      prisma.comment.groupBy({
        by: ['authorId'],
        where: { deletedAt: null, isPending: false },
        _count: { _all: true },
      }),
    ]);

    const posts = new Map<string, number>();
    for (const row of postGroups) posts.set(row.authorId, row._count._all);

    const comments = new Map<string, number>();
    for (const row of commentGroups) comments.set(row.authorId, row._count._all);

    return { posts, comments };
  }

  public async getUpheldReportCountsByReporter(): Promise<Map<string, number>> {
    const groups = await prisma.contentReport.groupBy({
      by: ['reporterId'],
      where: { status: 'RESOLVED' },
      _count: { _all: true },
    });
    const map = new Map<string, number>();
    for (const row of groups) {
      map.set(row.reporterId, row._count._all);
    }
    return map;
  }

  public async getNightContentCountsByAuthor(
    startHour: number,
    endHour: number,
    utcOffsetHours: number,
  ): Promise<Map<string, number>> {
    // 夜间小时窗口条件：[startHour, endHour]（含边界），支持跨零点（startHour > endHour）。
    // 时区换算：createdAt 为 UTC 存储，加上 utcOffsetHours 后取本地小时。
    const windowFilter =
      startHour <= endHour
        ? Prisma.sql`h >= ${startHour} AND h <= ${endHour}`
        : Prisma.sql`(h >= ${startHour} OR h <= ${endHour})`;

    const rows = await prisma.$queryRaw<Array<{ authorId: string; cnt: bigint }>>(Prisma.sql`
      SELECT "authorId", COUNT(*) AS cnt
      FROM (
        SELECT "authorId", EXTRACT(HOUR FROM ("createdAt" + make_interval(hours => ${utcOffsetHours})))::int AS h
          FROM "Post" WHERE "status" IN ('PUBLISHED', 'PINNED')
        UNION ALL
        SELECT "authorId", EXTRACT(HOUR FROM ("createdAt" + make_interval(hours => ${utcOffsetHours})))::int AS h
          FROM "Comment" WHERE "deletedAt" IS NULL AND "isPending" = false
      ) t
      WHERE ${windowFilter}
      GROUP BY "authorId"
    `);

    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.authorId, Number(row.cnt));
    }
    return map;
  }
}

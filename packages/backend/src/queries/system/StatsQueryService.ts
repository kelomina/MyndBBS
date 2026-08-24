/**
 * 查询服务：StatsQueryService
 *
 * 函数作用：
 *   管理统计仪表盘的读侧聚合（CQRS）：用户/帖子/评论总量、
 *   今日与近 7 天新增、待处理举报数。
 */
import { prisma } from '../../db';

export interface SiteStatsDTO {
  users: { total: number; today: number; last7Days: number };
  posts: { total: number; today: number; last7Days: number };
  comments: { total: number; today: number; last7Days: number };
  moderation: { pendingReports: number };
}

export class StatsQueryService {
  public async getSiteStats(): Promise<SiteStatsDTO> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      usersTotal, usersToday, users7d,
      postsTotal, postsToday, posts7d,
      commentsTotal, commentsToday, comments7d,
      pendingReports,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.post.count({ where: { status: { notIn: ['DELETED'] } } }),
      prisma.post.count({ where: { createdAt: { gte: startOfToday }, status: { notIn: ['DELETED'] } } }),
      prisma.post.count({ where: { createdAt: { gte: sevenDaysAgo }, status: { notIn: ['DELETED'] } } }),
      prisma.comment.count({ where: { deletedAt: null } }),
      prisma.comment.count({ where: { deletedAt: null, createdAt: { gte: startOfToday } } }),
      prisma.comment.count({ where: { deletedAt: null, createdAt: { gte: sevenDaysAgo } } }),
      prisma.contentReport.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      users: { total: usersTotal, today: usersToday, last7Days: users7d },
      posts: { total: postsTotal, today: postsToday, last7Days: posts7d },
      comments: { total: commentsTotal, today: commentsToday, last7Days: comments7d },
      moderation: { pendingReports },
    };
  }
}

export const statsQueryService = new StatsQueryService();

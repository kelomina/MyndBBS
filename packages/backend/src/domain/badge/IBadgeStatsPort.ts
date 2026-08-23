/**
 * 端口接口：IBadgeStatsPort
 *
 * 函数作用：
 *   徽章自动评估所需的用户统计数据读取端口（CQRS 读侧适配）。
 *   由 infrastructure 层提供基于 Prisma 聚合查询的实现，
 *   使领域/应用层不直接依赖数据库细节。
 *
 * Purpose:
 *   Read-side port supplying user statistics needed by the badge auto-grant evaluator.
 */

/** 按作者聚合的内容数量（帖子数 / 评论数） */
export interface ContentCountsByAuthor {
  posts: Map<string, number>;
  comments: Map<string, number>;
}

export interface IBadgeStatsPort {
  /** 返回等级 >= threshold 的活跃用户 ID 列表 */
  getUserIdsWithLevelAtLeast(threshold: number): Promise<string[]>;

  /** 返回每位作者的已发布帖子数与有效评论数 */
  getContentCountsByAuthor(): Promise<ContentCountsByAuthor>;

  /**
   * 返回夜间时段内（本地时区 = UTC + utcOffsetHours）发布内容（帖子+评论）
   * 的数量，按作者聚合。窗口为 [startHour, endHour]（含边界），支持跨零点。
   */
  getNightContentCountsByAuthor(
    startHour: number,
    endHour: number,
    utcOffsetHours: number,
  ): Promise<Map<string, number>>;
}

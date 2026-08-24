/**
 * 仓储/适配器：PrismaAntiSpamAdapter
 *
 * 函数作用：
 *   AntiSpamService 所需的用户注册时间解析与新内容计数。
 */
import { prisma } from '../../db';

export class PrismaAntiSpamAdapter {
  public async getUserCreatedAt(userId: string): Promise<Date | null> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    return user?.createdAt ?? null;
  }

  /** 有效发帖（PUBLISHED/PINNED/PENDING）+ 未删除评论，按小时窗口计数 */
  public async countRecentContentsByAuthor(userId: string, since: Date): Promise<number> {
    const [posts, comments] = await Promise.all([
      prisma.post.count({
        where: {
          authorId: userId,
          createdAt: { gte: since },
          status: { in: ['PUBLISHED', 'PINNED', 'PENDING'] },
        },
      }),
      prisma.comment.count({
        where: {
          authorId: userId,
          createdAt: { gte: since },
          deletedAt: null,
        },
      }),
    ]);
    return posts + comments;
  }
}

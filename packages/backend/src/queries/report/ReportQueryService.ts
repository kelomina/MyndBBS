/**
 * 查询服务：ReportQueryService
 *
 * 函数作用：
 *   举报管理队列的读侧查询（CQRS）：分页列表 + 目标内容快照
 *   （帖子标题/正文或评论内容，截断展示）+ 举报人/被举报人用户名。
 */
import { prisma } from '../../db';
import { ReportStatus, ReportTargetType } from '../../domain/community/ReportEnums';

export interface ReportListItemDTO {
  id: string;
  targetType: ReportTargetType;
  reason: string;
  detail: string | null;
  status: ReportStatus;
  postId: string;
  commentId: string | null;
  reporterUsername: string;
  targetAuthorUsername: string | null;
  targetPreview: string;
  handledByUsername: string | null;
  resolutionNote: string | null;
  createdAt: Date;
  handledAt: Date | null;
}

export class ReportQueryService {
  public async listReports(params: {
    status?: ReportStatus | undefined;
    targetType?: ReportTargetType | undefined;
    skip?: number | undefined;
    take?: number | undefined;
  }): Promise<{ items: ReportListItemDTO[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status;
    if (params.targetType) where.targetType = params.targetType;

    const [rows, total] = await Promise.all([
      prisma.contentReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip ?? 0,
        take: Math.min(Math.max(params.take ?? 20, 1), 100),
      }),
      prisma.contentReport.count({ where }),
    ]);

    // ── 批量取目标快照与相关用户名 ──
    const postIds = [...new Set(rows.map((r) => r.postId))];
    const commentIds = rows.filter((r) => r.commentId).map((r) => r.commentId!) ;
    const userIds = new Set<string>();

    const [posts, comments] = await Promise.all([
      postIds.length
        ? prisma.post.findMany({
            where: { id: { in: postIds } },
            select: { id: true, title: true, content: true, authorId: true },
          })
        : Promise.resolve([]),
      commentIds.length
        ? prisma.comment.findMany({
            where: { id: { in: commentIds } },
            select: { id: true, content: true, authorId: true, deletedAt: true },
          })
        : Promise.resolve([]),
    ]);

    for (const p of posts) userIds.add(p.authorId);
    for (const c of comments) userIds.add(c.authorId);
    for (const r of rows) {
      userIds.add(r.reporterId);
      if (r.handledBy) userIds.add(r.handledBy);
    }

    const users = userIds.size
      ? await prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, username: true } })
      : [];
    const usernameById = new Map(users.map((u) => [u.id, u.username]));

    const postById = new Map(posts.map((p) => [p.id, p]));
    const commentById = new Map(comments.map((c) => [c.id, c]));
    const preview = (text: string) => (text.length > 140 ? `${text.slice(0, 140)}…` : text);

    return {
      total,
      items: rows.map((r) => {
        let targetPreview = '(content unavailable)';
        let targetAuthorUsername: string | null = null;

        if (r.targetType === 'POST') {
          const post = postById.get(r.postId);
          if (post) {
            targetPreview = preview(`${post.title}\n${post.content}`);
            targetAuthorUsername = usernameById.get(post.authorId) ?? null;
          }
        } else if (r.commentId) {
          const comment = commentById.get(r.commentId);
          if (comment) {
            targetPreview = preview(comment.deletedAt ? '(deleted comment)' : comment.content);
            targetAuthorUsername = usernameById.get(comment.authorId) ?? null;
          }
        }

        return {
          id: r.id,
          targetType: r.targetType,
          reason: r.reason,
          detail: r.detail,
          status: r.status,
          postId: r.postId,
          commentId: r.commentId,
          reporterUsername: usernameById.get(r.reporterId) ?? '?',
          targetAuthorUsername,
          targetPreview,
          handledByUsername: r.handledBy ? usernameById.get(r.handledBy) ?? null : null,
          resolutionNote: r.resolutionNote,
          createdAt: r.createdAt,
          handledAt: r.handledAt,
        };
      }),
    };
  }
}

export const reportQueryService = new ReportQueryService();

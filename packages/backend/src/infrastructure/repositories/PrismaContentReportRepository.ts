/**
 * 仓储实现：PrismaContentReportRepository
 *
 * 函数作用：
 *   IContentReportRepository 的 Prisma 实现。
 *   去重采用应用层查询（PG 对 NULL 参与的唯一约束视为互异，无法用
 *   部分唯一索引覆盖 commentId 可空的组合）。
 */
import { ContentReport, ContentReportProps } from '../../domain/community/ContentReport';
import { IContentReportRepository, ContentReportListFilter, ContentReportListResult } from '../../domain/community/IContentReportRepository';
import { ReportStatus, ReportTargetType } from '../../domain/community/ReportEnums';
import { prisma } from '../../db';

export class PrismaContentReportRepository implements IContentReportRepository {
  private toDomain(raw: Record<string, unknown>): ContentReport {
    const props: ContentReportProps = {
      id: raw.id as string,
      reporterId: raw.reporterId as string,
      targetType: raw.targetType as ReportTargetType,
      postId: raw.postId as string,
      commentId: (raw.commentId as string | null) ?? null,
      reason: raw.reason as ContentReportProps['reason'],
      detail: (raw.detail as string | null) ?? null,
      status: raw.status as ReportStatus,
      handledBy: (raw.handledBy as string | null) ?? null,
      handledAt: (raw.handledAt as Date | null) ?? null,
      resolutionNote: (raw.resolutionNote as string | null) ?? null,
      createdAt: raw.createdAt as Date,
      updatedAt: raw.updatedAt as Date,
    };
    return ContentReport.fromPersistence(props);
  }

  public async findById(id: string): Promise<ContentReport | null> {
    const raw = await prisma.contentReport.findUnique({ where: { id } });
    return raw ? this.toDomain(raw) : null;
  }

  public async existsDuplicate(params: {
    reporterId: string;
    targetType: ReportTargetType;
    postId: string;
    commentId: string | null;
  }): Promise<boolean> {
    const found = await prisma.contentReport.findFirst({
      where: {
        reporterId: params.reporterId,
        targetType: params.targetType,
        postId: params.postId,
        commentId: params.commentId ?? null,
      },
      select: { id: true },
    });
    return Boolean(found);
  }

  public async save(report: ContentReport): Promise<void> {
    await prisma.contentReport.upsert({
      where: { id: report.id },
      create: {
        id: report.id,
        reporterId: report.reporterId,
        targetType: report.targetType,
        postId: report.postId,
        commentId: report.commentId,
        reason: report.reason,
        detail: report.detail,
        status: report.status,
        handledBy: report.handledBy,
        handledAt: report.handledAt,
        resolutionNote: report.resolutionNote,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      },
      update: {
        status: report.status,
        handledBy: report.handledBy,
        handledAt: report.handledAt,
        resolutionNote: report.resolutionNote,
        updatedAt: report.updatedAt,
      },
    });
  }

  public async list(filter: ContentReportListFilter): Promise<ContentReportListResult> {
    const where: Record<string, unknown> = {};
    if (filter.status) where.status = filter.status;
    if (filter.targetType) where.targetType = filter.targetType;

    const [rows, total] = await Promise.all([
      prisma.contentReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filter.skip ?? 0,
        take: Math.min(Math.max(filter.take ?? 20, 1), 100),
      }),
      prisma.contentReport.count({ where }),
    ]);
    return { items: rows.map((raw) => this.toDomain(raw)), total };
  }
}

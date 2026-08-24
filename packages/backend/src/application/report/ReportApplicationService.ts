/**
 * 应用服务：ReportApplicationService
 *
 * 函数作用：
 *   用户举报限界上下文的应用服务：
 *     1. 提交举报（目标存在性/自举报/去重/OTHER 详情必填校验）
 *     2. 版主处理：成立（RESOLVED，发布 ReportResolvedEvent 驱动徽章即时评估）
 *        与驳回（DISMISSED）
 *
 * Purpose:
 *   Application service for the content-report bounded context.
 */
import { randomUUID } from 'crypto';
import { ContentReport } from '../../domain/community/ContentReport';
import { IContentReportRepository, ContentReportListFilter, ContentReportListResult } from '../../domain/community/IContentReportRepository';
import { ReportReason, ReportTargetType } from '../../domain/community/ReportEnums';
import { IUnitOfWork } from '../../domain/shared/IUnitOfWork';
import { IEventBus } from '../../domain/shared/events/IEventBus';
import { ReportResolvedEvent } from '../../domain/shared/events/DomainEvents';

export interface ReportApplicationServiceOptions {
  reportRepository: IContentReportRepository;
  postRepository: { findById(id: string): Promise<{ id: string; authorId: string } | null> };
  commentRepository: { findById(id: string): Promise<{ id: string; authorId: string; postId: string } | null> };
  eventBus: IEventBus;
}

export interface SubmitReportInput {
  reporterId: string;
  targetType: ReportTargetType;
  postId: string;
  commentId?: string | null;
  reason: ReportReason;
  detail?: string | null;
}

export class ReportApplicationService {
  constructor(private readonly opts: ReportApplicationServiceOptions) {}

  /**
   * 提交举报。返回新建的举报 ID。
   */
  public async submitReport(input: SubmitReportInput): Promise<string> {
    const commentId = input.targetType === 'COMMENT' ? input.commentId ?? null : null;

    // ── 目标存在性 + 自举报校验 ──
    let authorId: string | null = null;
    if (input.targetType === 'POST') {
      const post = await this.opts.postRepository.findById(input.postId);
      if (!post) throw new Error('ERR_REPORT_TARGET_NOT_FOUND');
      authorId = post.authorId;
    } else {
      if (!commentId) throw new Error('ERR_BAD_REQUEST');
      const comment = await this.opts.commentRepository.findById(commentId);
      if (!comment || comment.postId !== input.postId) {
        throw new Error('ERR_REPORT_TARGET_NOT_FOUND');
      }
      authorId = comment.authorId;
    }
    if (authorId === input.reporterId) {
      throw new Error('ERR_REPORT_SELF_TARGET');
    }

    // ── 去重 ──
    if (
      await this.opts.reportRepository.existsDuplicate({
        reporterId: input.reporterId,
        targetType: input.targetType,
        postId: input.postId,
        commentId,
      })
    ) {
      throw new Error('ERR_REPORT_ALREADY_SUBMITTED');
    }

    const report = ContentReport.submit({
      id: randomUUID(),
      reporterId: input.reporterId,
      targetType: input.targetType,
      postId: input.postId,
      commentId,
      reason: input.reason,
      detail: input.detail ?? null,
    });
    await this.opts.reportRepository.save(report);
    return report.id;
  }

  public async resolveReport(handlerId: string, reportId: string, note?: string | null): Promise<void> {
    const report = await this.getReportOrThrow(reportId);
    report.resolve(handlerId, note);
    await this.opts.reportRepository.save(report);
    // 成立时发布事件：驱动举报人徽章即时评估（评估失败由周期任务兜底）
    await this.opts.eventBus.publish(new ReportResolvedEvent(report.id, report.reporterId, handlerId));
  }

  public async dismissReport(handlerId: string, reportId: string, note?: string | null): Promise<void> {
    const report = await this.getReportOrThrow(reportId);
    report.dismiss(handlerId, note);
    await this.opts.reportRepository.save(report);
  }

  public async listReports(filter: ContentReportListFilter): Promise<ContentReportListResult> {
    return this.opts.reportRepository.list(filter);
  }

  private async getReportOrThrow(reportId: string): Promise<ContentReport> {
    const report = await this.opts.reportRepository.findById(reportId);
    if (!report) throw new Error('ERR_REPORT_NOT_FOUND');
    return report;
  }
}

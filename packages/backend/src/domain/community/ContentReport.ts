/**
 * 实体：ContentReport
 *
 * 函数作用：
 *   用户举报的聚合根。封装举报目标（帖子/评论）、理由分类、处理状态机
 *   （PENDING → RESOLVED | DISMISSED，终态不可再流转）与不变量：
 *     - POST 举报必须携带 postId；COMMENT 举报必须同时携带 commentId 与 postId
 *     - OTHER 理由必须提供 detail 说明
 *     - 仅 PENDING 状态可被 resolve/dismiss
 *
 * Purpose:
 *   Aggregate root for user-submitted content reports with a strict
 *   terminal-state machine and target/reason invariants.
 */
import { ReportReason, ReportStatus, ReportTargetType } from './ReportEnums';

export interface ContentReportProps {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  postId: string;
  commentId: string | null;
  reason: ReportReason;
  detail: string | null;
  status: ReportStatus;
  handledBy: string | null;
  handledAt: Date | null;
  resolutionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const MAX_REPORT_DETAIL_LENGTH = 500;

export class ContentReport {
  private constructor(private props: ContentReportProps) {}

  /**
   * 创建一条新的 PENDING 举报。校验目标结构与理由不变量。
   */
  public static submit(props: {
    id: string;
    reporterId: string;
    targetType: ReportTargetType;
    postId: string;
    commentId?: string | null;
    reason: ReportReason;
    detail?: string | null;
  }): ContentReport {
    if (!props.reporterId || !props.postId) {
      throw new Error('ERR_BAD_REQUEST');
    }
    if (props.targetType === 'COMMENT' && !props.commentId) {
      throw new Error('ERR_BAD_REQUEST');
    }
    if (props.reason === 'OTHER' && !props.detail?.trim()) {
      throw new Error('ERR_REPORT_REASON_DETAIL_REQUIRED');
    }
    const now = new Date();
    return new ContentReport({
      ...props,
      commentId: props.commentId ?? null,
      detail: props.detail ?? null,
      status: 'PENDING',
      handledBy: null,
      handledAt: null,
      resolutionNote: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * 从持久化记录重建实体。
   */
  public static fromPersistence(props: ContentReportProps): ContentReport {
    return new ContentReport(props);
  }

  // --- 访问器 ---
  public get id(): string { return this.props.id; }
  public get reporterId(): string { return this.props.reporterId; }
  public get targetType(): ReportTargetType { return this.props.targetType; }
  public get postId(): string { return this.props.postId; }
  public get commentId(): string | null { return this.props.commentId; }
  public get reason(): ReportReason { return this.props.reason; }
  public get detail(): string | null { return this.props.detail; }
  public get status(): ReportStatus { return this.props.status; }
  public get handledBy(): string | null { return this.props.handledBy; }
  public get handledAt(): Date | null { return this.props.handledAt; }
  public get resolutionNote(): string | null { return this.props.resolutionNote; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }

  public isPending(): boolean {
    return this.props.status === 'PENDING';
  }

  private transition(status: ReportStatus, handlerId: string, note?: string | null): void {
    if (!this.isPending()) {
      throw new Error('ERR_REPORT_ALREADY_HANDLED');
    }
    this.props.status = status;
    this.props.handledBy = handlerId;
    this.props.handledAt = new Date();
    this.props.resolutionNote = note ?? null;
    this.props.updatedAt = new Date();
  }

  /** 标记成立（举报被采纳） */
  public resolve(handlerId: string, note?: string | null): void {
    this.transition('RESOLVED', handlerId, note);
  }

  /** 标记驳回（举报不成立） */
  public dismiss(handlerId: string, note?: string | null): void {
    this.transition('DISMISSED', handlerId, note);
  }
}

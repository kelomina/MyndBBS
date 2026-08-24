/**
 * 用户举报相关的前端类型定义。
 */

export type ReportTargetType = 'POST' | 'COMMENT';

export type ReportReason =
  | 'SPAM'
  | 'PORNOGRAPHY'
  | 'ILLEGAL'
  | 'ABUSE'
  | 'COPYRIGHT'
  | 'OTHER';

export interface SubmitReportPayload {
  targetType: ReportTargetType;
  postId: string;
  commentId?: string;
  reason: ReportReason;
  detail?: string;
}

/** 管理面板举报列表项 */
export interface AdminReportItem {
  id: string;
  targetType: ReportTargetType;
  reason: ReportReason;
  detail: string | null;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  postId: string;
  commentId: string | null;
  reporterUsername: string;
  targetAuthorUsername: string | null;
  targetPreview: string;
  handledByUsername: string | null;
  resolutionNote: string | null;
  createdAt: string;
  handledAt: string | null;
}

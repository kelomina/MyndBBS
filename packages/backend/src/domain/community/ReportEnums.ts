/**
 * 枚举：举报相关（ReportStatus / ReportTargetType / ReportReason）
 *
 * 说明：与 Prisma schema 中的同名枚举保持字面量一致；
 * 领域层使用本文件的字符串联合类型，避免直接依赖生成的 client。
 */
export type ReportStatus = 'PENDING' | 'RESOLVED' | 'DISMISSED';
export type ReportTargetType = 'POST' | 'COMMENT';
export type ReportReason = 'SPAM' | 'PORNOGRAPHY' | 'ILLEGAL' | 'ABUSE' | 'COPYRIGHT' | 'OTHER';

export const REPORT_REASONS: readonly ReportReason[] = [
  'SPAM',
  'PORNOGRAPHY',
  'ILLEGAL',
  'ABUSE',
  'COPYRIGHT',
  'OTHER',
];

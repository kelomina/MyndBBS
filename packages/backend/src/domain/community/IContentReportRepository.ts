/**
 * 接口名称：IContentReportRepository
 *
 * 函数作用：
 *   用户举报聚合的仓储接口。去重查询与状态统计是核心能力。
 */
import { ContentReport } from './ContentReport';
import { ReportStatus, ReportTargetType } from './ReportEnums';

export interface ContentReportListFilter {
  status?: ReportStatus | undefined;
  targetType?: ReportTargetType | undefined;
  skip?: number | undefined;
  take?: number | undefined;
}

export interface ContentReportListResult {
  items: ContentReport[];
  total: number;
}

export interface IContentReportRepository {
  findById(id: string): Promise<ContentReport | null>;

  /** 同一举报人对同一目标的既有举报（任意状态），用于提交去重 */
  existsDuplicate(params: {
    reporterId: string;
    targetType: ReportTargetType;
    postId: string;
    commentId: string | null;
  }): Promise<boolean>;

  save(report: ContentReport): Promise<void>;

  list(filter: ContentReportListFilter): Promise<ContentReportListResult>;
}

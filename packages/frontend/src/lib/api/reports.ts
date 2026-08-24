import { fetcher } from './fetcher';
import type { SubmitReportPayload } from '../../types/reports';

/**
 * 提交用户举报（帖子/评论）。
 */
export const submitReport = (
  payload: SubmitReportPayload
): Promise<{ message: string; report: { id: string; status: string } }> =>
  fetcher('/api/v1/reports', { method: 'POST', body: JSON.stringify(payload) });

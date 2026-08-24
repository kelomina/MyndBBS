/**
 * 类型：站点防灌水策略（SitePolicy key = 'anti_spam'）
 *
 * 所有阈值 0 表示关闭对应规则；accountAgeDays 定义"新用户"窗口
 * （注册距今不足 N 天视为新用户）。
 */
export interface AntiSpamPolicy {
  /** 新用户窗口（天）。0 = 防灌水整体关闭 */
  accountAgeDays: number;
  /** 注册后 cooldownMinutes 分钟内禁止发帖/评论。0 = 关闭 */
  cooldownMinutes: number;
  /** 新用户每小时最多发布帖子+评论条数。0 = 不限 */
  maxNewContentsPerHour: number;
}

export const ANTI_SPAM_POLICY_KEY = 'anti_spam';

export const DEFAULT_ANTI_SPAM_POLICY: AntiSpamPolicy = {
  accountAgeDays: 0,
  cooldownMinutes: 0,
  maxNewContentsPerHour: 0,
};

function clampInt(value: unknown, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), max);
}

/** 从任意 JSON 解析并校验策略，非法字段回落默认值（整体关闭） */
export function parseAntiSpamPolicy(json: unknown): AntiSpamPolicy {
  if (json === null || typeof json !== 'object') return { ...DEFAULT_ANTI_SPAM_POLICY };
  const raw = json as Record<string, unknown>;
  return {
    accountAgeDays: clampInt(raw.accountAgeDays, 365),
    cooldownMinutes: clampInt(raw.cooldownMinutes, 10080),
    maxNewContentsPerHour: clampInt(raw.maxNewContentsPerHour, 1000),
  };
}

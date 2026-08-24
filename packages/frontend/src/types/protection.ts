/**
 * 治理强化相关的前端类型定义（IP 封禁 / 防灌水策略）。
 */

export type IpBanScope = 'ALL' | 'REGISTRATION';

export interface BannedIpItem {
  id: string;
  ip: string;
  scope: IpBanScope;
  reason: string | null;
  createdAt: string;
  expiresAt: string | null;
}

/** 防灌水策略：0 表示关闭对应规则 */
export interface AntiSpamPolicy {
  /** 新用户窗口（天）。0 = 整体关闭 */
  accountAgeDays: number;
  /** 注册后 N 分钟内禁止发布。0 = 关闭 */
  cooldownMinutes: number;
  /** 新用户每小时最多发布内容数。0 = 不限 */
  maxNewContentsPerHour: number;
}

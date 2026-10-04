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

/**
 * 读限流与解锁配置（冻结契约 API-SPEC v1.0.2 RateLimitProtectionConfig 7 字段）。
 * PUT/GET 同形；exemptionScope 只接受 'ip'；loginRelaxed 只接受 false。
 */
export type CaptchaStrength = 'low' | 'normal' | 'strict';

export interface RateLimitProtectionConfig {
  /** 总开关（读解锁链路开关），默认 true */
  enabled: boolean;
  /** publicReadLimiter max，10–1000，默认 30 */
  publicReadMax: number;
  /** 窗口秒数离散档，默认 60 */
  windowSec: 10 | 30 | 60 | 300 | 600;
  /** 验证强度档，默认 low */
  captchaStrength: CaptchaStrength;
  /** IP 豁免时长分钟，1–120，默认 15 */
  exemptionMinutes: number;
  /** v1 只读 ip */
  exemptionScope: 'ip';
  /** Q3 冻结恒 false */
  loginRelaxed: false;
}

export type RateLimitProtectionUpdate = RateLimitProtectionConfig;

export interface RateLimitProtectionUpdateResult {
  message: 'RATE_LIMIT_POLICY_UPDATED';
  policy: RateLimitProtectionConfig;
}

export const RATE_LIMIT_POLICY_DEFAULTS: RateLimitProtectionConfig = {
  enabled: true,
  publicReadMax: 30,
  windowSec: 60,
  captchaStrength: 'low',
  exemptionMinutes: 15,
  exemptionScope: 'ip',
  loginRelaxed: false,
};

export const RATE_LIMIT_WINDOW_OPTIONS: ReadonlyArray<RateLimitProtectionConfig['windowSec']> = [
  10, 30, 60, 300, 600,
];

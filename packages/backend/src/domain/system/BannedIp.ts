/**
 * 实体：BannedIp
 *
 * 函数作用：
 *   IP 封禁记录。scope 决定封禁范围（全站 = 注册+登录；REGISTRATION =
 *   仅禁止注册新账号）。expiresAt 为 null 表示永久。
 */
import { IpBanScope } from './IpBanScope';

export interface BannedIpProps {
  id: string;
  ip: string;
  scope: IpBanScope;
  reason: string | null;
  createdBy: string | null;
  createdAt: Date;
  expiresAt: Date | null;
}

const IPV4_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** 基本格式校验（最终合法性由 PostgreSQL inet 类型裁决） */
export function isValidIp(value: string): boolean {
  if (!value || value.length > 45) return false;
  const v4 = value.match(IPV4_REGEX);
  if (v4) {
    return v4.slice(1).every((octet) => Number(octet) <= 255);
  }
  return value.includes(':') && /^[0-9a-fA-F:.]+$/.test(value);
}

export class BannedIp {
  private constructor(private props: BannedIpProps) {}

  public static create(props: {
    id: string;
    ip: string;
    scope: IpBanScope;
    reason?: string | null;
    createdBy?: string | null;
    expiresAt?: Date | null;
  }): BannedIp {
    if (!isValidIp(props.ip)) {
      throw new Error('ERR_INVALID_IP');
    }
    const now = new Date();
    return new BannedIp({
      ...props,
      reason: props.reason ?? null,
      createdBy: props.createdBy ?? null,
      createdAt: now,
      expiresAt: props.expiresAt ?? null,
    });
  }

  public static fromPersistence(props: BannedIpProps): BannedIp {
    return new BannedIp(props);
  }

  public get id(): string { return this.props.id; }
  public get ip(): string { return this.props.ip; }
  public get scope(): IpBanScope { return this.props.scope; }
  public get reason(): string | null { return this.props.reason; }
  public get createdBy(): string | null { return this.props.createdBy; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get expiresAt(): Date | null { return this.props.expiresAt; }

  /** 是否处于生效期（永久或未过期） */
  public isActive(now: Date = new Date()): boolean {
    return this.props.expiresAt === null || this.props.expiresAt > now;
  }

  /** 该封禁是否覆盖给定用途：注册受 ALL 与 REGISTRATION 双重覆盖，登录仅受 ALL 覆盖 */
  public covers(purpose: 'LOGIN' | 'REGISTRATION'): boolean {
    if (purpose === 'REGISTRATION') return true;
    return this.props.scope === 'ALL';
  }
}

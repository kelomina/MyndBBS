/**
 * 接口名称：IBannedIpRepository
 */
import { BannedIp } from './BannedIp';
import { IpBanScope } from './IpBanScope';

export interface IBannedIpRepository {
  findById(id: string): Promise<BannedIp | null>;

  /** 查询对给定 IP + 用途生效中的封禁（未过期且 scope 覆盖该用途） */
  findActiveBan(ip: string, purpose: 'LOGIN' | 'REGISTRATION'): Promise<BannedIp | null>;

  listAll(): Promise<BannedIp[]>;

  /** 按 ip 唯一约束插入；冲突返回 false */
  insert(ban: BannedIp): Promise<boolean>;

  delete(id: string): Promise<boolean>;
}

export type { IpBanScope };

/**
 * 应用服务：IpBanApplicationService
 *
 * 函数作用：
 *   IP 封禁的管理（列表/封禁/解封）与运行时判定 isBanned(ip, purpose)。
 *   活跃封禁名单带 60 秒内存缓存，降低注册/登录热路径的查询开销。
 */
import { randomUUID } from 'crypto';
import { BannedIp } from '../../domain/system/BannedIp';
import { IpBanScope } from '../../domain/system/IpBanScope';
import { IBannedIpRepository } from '../../domain/system/IBannedIpRepository';

export interface IpBanApplicationServiceOptions {
  bannedIpRepository: IBannedIpRepository;
}

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  bans: BannedIp[];
  loadedAt: number;
}

export class IpBanApplicationService {
  private cache: CacheEntry | null = null;

  constructor(private readonly opts: IpBanApplicationServiceOptions) {}

  private invalidate(): void {
    this.cache = null;
  }

  private async activeBans(): Promise<BannedIp[]> {
    if (this.cache && Date.now() - this.cache.loadedAt < CACHE_TTL_MS) {
      return this.cache.bans;
    }
    const all = await this.opts.bannedIpRepository.listAll();
    const bans = all.filter((b) => b.isActive());
    this.cache = { bans, loadedAt: Date.now() };
    return bans;
  }

  public async listBanned(): Promise<BannedIp[]> {
    return this.opts.bannedIpRepository.listAll();
  }

  /**
   * 封禁 IP。scope=REGISTRATION 仅阻止注册；ALL 同时阻止登录。
   * expiresInDays 缺省为永久。
   */
  public async banIp(params: {
    ip: string;
    scope: IpBanScope;
    reason?: string | null;
    operatorId: string;
    expiresInDays?: number | null;
  }): Promise<BannedIp> {
    const expiresAt =
      params.expiresInDays && params.expiresInDays > 0
        ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
        : null;
    const ban = BannedIp.create({
      id: randomUUID(),
      ip: params.ip,
      scope: params.scope,
      reason: params.reason ?? null,
      createdBy: params.operatorId,
      expiresAt,
    });
    const inserted = await this.opts.bannedIpRepository.insert(ban);
    if (!inserted) throw new Error('ERR_IP_ALREADY_BANNED');
    this.invalidate();
    return ban;
  }

  public async unbanIp(id: string): Promise<void> {
    const removed = await this.opts.bannedIpRepository.delete(id);
    if (!removed) throw new Error('ERR_IP_BAN_NOT_FOUND');
    this.invalidate();
  }

  /** 运行时判定：给定用途下该 IP 是否被封禁 */
  public async isBanned(ip: string, purpose: 'LOGIN' | 'REGISTRATION'): Promise<boolean> {
    const bans = await this.activeBans();
    return bans.some((b) => b.ip === ip && b.covers(purpose));
  }
}

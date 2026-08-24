/**
 * 应用服务：AntiSpamService
 *
 * 函数作用：
 *   新用户防灌水策略的读取（60 秒缓存）、管理更新与发帖/评论前的
 *   内容准入校验：
 *     - 冷却期：注册不足 cooldownMinutes 分钟禁止发布
 *     - 限频：新用户窗口内每小时发布内容数超过上限即拒绝
 */
import {
  ANTI_SPAM_POLICY_KEY,
  AntiSpamPolicy,
  DEFAULT_ANTI_SPAM_POLICY,
  parseAntiSpamPolicy,
} from '../../domain/system/SitePolicies';
import { ISitePolicyRepository } from '../../domain/system/ISitePolicyRepository';

export interface AntiSpamServiceOptions {
  sitePolicyRepository: ISitePolicyRepository;
  /** 解析用户注册时间；用户不存在返回 null */
  getUserCreatedAt: (userId: string) => Promise<Date | null>;
  /** 统计用户在 since 之后的发帖+评论总数 */
  countRecentContentsByAuthor: (userId: string, since: Date) => Promise<number>;
}

const CACHE_TTL_MS = 60_000;

export class AntiSpamService {
  private cache: { policy: AntiSpamPolicy; loadedAt: number } | null = null;

  constructor(private readonly opts: AntiSpamServiceOptions) {}

  public async getPolicy(): Promise<AntiSpamPolicy> {
    if (this.cache && Date.now() - this.cache.loadedAt < CACHE_TTL_MS) {
      return this.cache.policy;
    }
    const raw = await this.opts.sitePolicyRepository.get(ANTI_SPAM_POLICY_KEY);
    const policy = raw === null ? { ...DEFAULT_ANTI_SPAM_POLICY } : parseAntiSpamPolicy(raw);
    this.cache = { policy, loadedAt: Date.now() };
    return policy;
  }

  public async updatePolicy(patch: Partial<AntiSpamPolicy>): Promise<AntiSpamPolicy> {
    const current = await this.getPolicy();
    const merged = parseAntiSpamPolicy({ ...current, ...patch });
    await this.opts.sitePolicyRepository.set(ANTI_SPAM_POLICY_KEY, merged);
    this.cache = { policy: merged, loadedAt: Date.now() };
    return merged;
  }

  /**
   * 内容准入校验。规则未启用时直接放行。
   * @throws ERR_NEW_ACCOUNT_COOLDOWN / ERR_NEW_ACCOUNT_RATE_LIMITED
   */
  public async assertContentAllowed(userId: string): Promise<void> {
    const policy = await this.getPolicy();
    if (policy.accountAgeDays <= 0) return;

    const createdAt = await this.opts.getUserCreatedAt(userId);
    if (!createdAt) return; // 用户不存在交由后续流程处理

    const now = Date.now();
    const ageMs = now - createdAt.getTime();
    const windowMs = policy.accountAgeDays * 24 * 60 * 60 * 1000;
    if (ageMs >= windowMs) return; // 非新用户

    if (
      policy.cooldownMinutes > 0 &&
      ageMs < policy.cooldownMinutes * 60 * 1000
    ) {
      throw new Error('ERR_NEW_ACCOUNT_COOLDOWN');
    }

    if (policy.maxNewContentsPerHour > 0) {
      const recent = await this.opts.countRecentContentsByAuthor(userId, new Date(now - 60 * 60 * 1000));
      if (recent >= policy.maxNewContentsPerHour) {
        throw new Error('ERR_NEW_ACCOUNT_RATE_LIMITED');
      }
    }
  }
}

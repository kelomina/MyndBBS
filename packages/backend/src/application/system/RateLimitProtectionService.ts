/**
 * 应用服务：RateLimitProtectionService
 *
 * 读限流解锁配置（SitePolicy key = 'rate_limit_unlock'）的读写与 60s 读缓存。
 * - 冻结：API-SPEC v1.0.2 + PRD v1.1.1（7 字段、strict 无 coerce、TTL 60s、test 下 TTL=0）
 * - G2：本层 parse 仅缺字段补默认（读路径），不做 coerce/归一/clamp；PUT 写路径由 zod 严格 400，不走补默认
 */
import {
  RATE_LIMIT_PROTECTION_KEY,
  DEFAULT_RATE_LIMIT_PROTECTION_POLICY,
  parseRateLimitProtectionPolicy,
  type RateLimitProtectionPolicy,
} from '../../domain/system/RateLimitProtection'
import type { ISitePolicyRepository } from '../../domain/system/ISitePolicyRepository'

const CACHE_TTL_MS = 60_000

function isTestEnv(): boolean {
  return process.env.NODE_ENV === 'test'
}

export interface RateLimitProtectionServiceOptions {
  sitePolicyRepository: ISitePolicyRepository
}

export class RateLimitProtectionService {
  private cache: { policy: RateLimitProtectionPolicy; loadedAt: number } | null = null

  constructor(private readonly opts: RateLimitProtectionServiceOptions) {}

  public async getPolicy(): Promise<RateLimitProtectionPolicy> {
    // 测试下 TTL=0 即时生效（AC-管理；否则需 sleep 60s）
    if (this.cache && !isTestEnv() && Date.now() - this.cache.loadedAt < CACHE_TTL_MS) {
      return this.cache.policy
    }
    const raw = await this.opts.sitePolicyRepository.get(RATE_LIMIT_PROTECTION_KEY)
    const policy =
      raw === null
        ? { ...DEFAULT_RATE_LIMIT_PROTECTION_POLICY }
        : parseRateLimitProtectionPolicy(raw)
    this.cache = { policy, loadedAt: Date.now() }
    return policy
  }

  /**
   * PUT 写路径：调用方必须先经 zod 严格校验（全量 7 字段、无 coerce、未知字段 400）。
   * 本方法只做全量覆盖落盘 + 刷新缓存，不做 merge/补默认/clamp。
   */
  public async replacePolicy(next: RateLimitProtectionPolicy): Promise<RateLimitProtectionPolicy> {
    await this.opts.sitePolicyRepository.set(RATE_LIMIT_PROTECTION_KEY, next)
    this.cache = { policy: { ...next }, loadedAt: Date.now() }
    return { ...next }
  }

  public clearCache(): void {
    this.cache = null
  }
}

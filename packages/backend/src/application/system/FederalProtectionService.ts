/**
 * 应用服务：FederalProtectionService
 *
 * 联邦验证管理配置（SitePolicy key = 'captcha_federal'）的读写与 60s 读缓存。
 * - 冻结：API-SPEC-TAG-CAPTCHA-NOTIFY v1.0.1 + 演示批准增量（6 字段必填 + strictTimeoutSec 可选缺省 15、strict 无 coerce、TTL 60s、test 下 TTL=0；GET 回显恒含 strictTimeoutSec）
 * - G2：本层 parse 仅缺字段补默认（读路径），不做 coerce/归一/clamp；PUT 写路径由 zod 严格 400（除 strictTimeoutSec 可选缺省外），不走补默认
 */
import {
  FEDERAL_PROTECTION_KEY,
  DEFAULT_FEDERAL_PROTECTION_POLICY,
  parseFederalProtectionPolicy,
  type FederalProtectionPolicy,
} from '../../domain/system/FederalProtection'
import type { ISitePolicyRepository } from '../../domain/system/ISitePolicyRepository'

const CACHE_TTL_MS = 60_000

function isTestEnv(): boolean {
  return process.env.NODE_ENV === 'test'
}

export interface FederalProtectionServiceOptions {
  sitePolicyRepository: ISitePolicyRepository
}

export class FederalProtectionService {
  private cache: { policy: FederalProtectionPolicy; loadedAt: number } | null = null

  constructor(private readonly opts: FederalProtectionServiceOptions) {}

  public async getPolicy(): Promise<FederalProtectionPolicy> {
    // 测试下 TTL=0 即时生效（AC-FED-1；否则需 sleep 60s）
    if (this.cache && !isTestEnv() && Date.now() - this.cache.loadedAt < CACHE_TTL_MS) {
      return this.cache.policy
    }
    const raw = await this.opts.sitePolicyRepository.get(FEDERAL_PROTECTION_KEY)
    const policy =
      raw === null
        ? {
            ...DEFAULT_FEDERAL_PROTECTION_POLICY,
            kinds: { ...DEFAULT_FEDERAL_PROTECTION_POLICY.kinds },
          }
        : parseFederalProtectionPolicy(raw)
    this.cache = { policy, loadedAt: Date.now() }
    return policy
  }

  /**
   * PUT 写路径：调用方必须先经 zod 严格校验（6 字段必填 + strictTimeoutSec 可选缺省 15、无 coerce、未知字段 400、全关 400、defaultKind 指已关 400；strictTimeoutSec 传了仍按 5–60 校验）。
   * 本方法只做全量覆盖落盘 + 刷新缓存，不做 merge/补默认/clamp。
   */
  public async replacePolicy(next: FederalProtectionPolicy): Promise<FederalProtectionPolicy> {
    await this.opts.sitePolicyRepository.set(FEDERAL_PROTECTION_KEY, next)
    this.cache = {
      policy: { ...next, kinds: { ...next.kinds } },
      loadedAt: Date.now(),
    }
    return { ...next, kinds: { ...next.kinds } }
  }

  public clearCache(): void {
    this.cache = null
  }
}

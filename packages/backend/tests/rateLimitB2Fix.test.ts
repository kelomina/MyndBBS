/**
 * B2 修复回归（channel-qa 19:00 帧，TAG v1.0.3）：
 * - a) 单例注入合一（setShared/clear 双清，不抛）
 * - b) 换窗清全部读桶（新窗从 0 计，计数归零为预期；max 变更不清桶由动态 limit 保证，此处仅断言换窗清桶）
 * - c) handler 回退读最后观测政策值（lastObserved 经政策读刷新，不再恒 60）
 * - d) effective 快照与 TEST 语义一致（test-override vs policy；生产忽略 TEST_*）
 * 约束：写限流/searchLimiter/trust proxy 不动；测试钩子语义不变（本文件用后即恢复 env/注入）。
 */
import {
  setSharedRateLimitProtectionService,
  clearRateLimitProtectionCache,
  getEffectiveRateLimitSnapshot,
  getLastObservedRateLimitWindow,
  handleRateLimitWindowChange,
  publicReadLimiter,
} from '../src/lib/rateLimit'
import { DEFAULT_RATE_LIMIT_PROTECTION_POLICY } from '../src/domain/system/RateLimitProtection'

function mockPolicyService(policy: { publicReadMax: number; windowSec: number }): {
  getPolicy: () => Promise<unknown>
  clearCache: () => void
} {
  return {
    getPolicy: () =>
      Promise.resolve({
        ...DEFAULT_RATE_LIMIT_PROTECTION_POLICY,
        publicReadMax: policy.publicReadMax,
        windowSec: policy.windowSec,
      }),
    clearCache: () => undefined,
  }
}

function createMockReqRes(ip: string): {
  req: Record<string, unknown>
  res: Record<string, unknown> & {
    statusCode: number
    headers: Record<string, string>
    body: unknown
    nextCalled: boolean
  }
  next: () => void
} {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as unknown,
    writableEnded: false,
    headersSent: false,
    nextCalled: false,
    setHeader(key: string, value: string): void {
      this.headers[key] = value
    },
    getHeader(key: string): string | undefined {
      return this.headers[key]
    },
    status(code: number): unknown {
      this.statusCode = code
      return this
    },
    send(data: unknown): unknown {
      this.body = data
      this.writableEnded = true
      return this
    },
    json(data: unknown): unknown {
      this.body = data
      this.writableEnded = true
      return this
    },
    on(): unknown {
      return this
    },
    once(): unknown {
      return this
    },
  }
  const req = {
    ip,
    socket: { remoteAddress: ip },
    headers: {},
    app: { get: () => false },
  }
  const next = (): void => {
    res.nextCalled = true
  }
  return { req, res, next }
}

describe('B2 rate-limit window fix (TAG v1.0.3)', () => {
  const prevEnv = { ...process.env }

  afterEach(async () => {
    process.env = { ...prevEnv }
    setSharedRateLimitProtectionService(null)
    clearRateLimitProtectionCache()
    try {
      await publicReadLimiter.resetKey('127.0.0.99')
    } catch {
      // ignore
    }
  })

  it('a) 注入实例优先生效且双清不抛（单例合一）', async () => {
    const injected = mockPolicyService({ publicReadMax: 42, windowSec: 300 })
    setSharedRateLimitProtectionService(injected as never)
    const snap = await getEffectiveRateLimitSnapshot()
    // 非 test 下 TEST_* 忽略（生产恒 policy）；此处 NODE_ENV=test 但无 TEST_*，故 policy 生效
    expect(snap.max).toBe(42)
    expect(snap.windowSec).toBe(300)
    expect(snap.source).toBe('policy')
    expect(() => clearRateLimitProtectionCache()).not.toThrow()
  })

  it('d) TEST 覆盖时 source=test-override 且语义与旧钩子一致', async () => {
    process.env.NODE_ENV = 'test'
    process.env.TEST_READ_MAX = '10'
    process.env.TEST_READ_WINDOW_SEC = '10'
    const injected = mockPolicyService({ publicReadMax: 42, windowSec: 300 })
    setSharedRateLimitProtectionService(injected as never)
    const snap = await getEffectiveRateLimitSnapshot()
    expect(snap.max).toBe(10)
    expect(snap.windowSec).toBe(10)
    expect(snap.source).toBe('test-override')
  })

  it('d) 非法 TEST 值忽略回政策值（钩子语义不变）', async () => {
    process.env.NODE_ENV = 'test'
    process.env.TEST_READ_MAX = '5000'
    process.env.TEST_READ_WINDOW_SEC = '999'
    const injected = mockPolicyService({ publicReadMax: 42, windowSec: 300 })
    setSharedRateLimitProtectionService(injected as never)
    const snap = await getEffectiveRateLimitSnapshot()
    expect(snap.max).toBe(42)
    expect(snap.windowSec).toBe(300)
    expect(snap.source).toBe('policy')
  })

  it('d) 生产下 TEST_* 忽略（生产不可达）', async () => {
    process.env.NODE_ENV = 'production'
    process.env.TEST_READ_MAX = '10'
    process.env.TEST_READ_WINDOW_SEC = '10'
    const injected = mockPolicyService({ publicReadMax: 42, windowSec: 300 })
    setSharedRateLimitProtectionService(injected as never)
    const snap = await getEffectiveRateLimitSnapshot()
    expect(snap.max).toBe(42)
    expect(snap.windowSec).toBe(300)
    expect(snap.source).toBe('policy')
  })

  it('b) 换 windowSec 清全部读桶（新窗从 0 计，计数归零为预期）', async () => {
    const ip = '127.0.0.99'
    const { req, res, next } = createMockReqRes(ip)
    await (
      publicReadLimiter as unknown as (a: unknown, b: unknown, c: () => void) => Promise<void>
    )(req, res, next)
    expect(res.nextCalled).toBe(true)
    const before = await publicReadLimiter.getKey(ip)
    expect(before?.totalHits).toBe(1)
    // 冻结策略：换窗清桶
    handleRateLimitWindowChange(60, 300)
    const after = await publicReadLimiter.getKey(ip)
    expect(after).toBeUndefined()
  })

  it('b) 同窗不清桶（prev===next 直接返回）', async () => {
    const ip = '127.0.0.99'
    const first = createMockReqRes(ip)
    await (
      publicReadLimiter as unknown as (a: unknown, b: unknown, c: () => void) => Promise<void>
    )(first.req, first.res, first.next)
    handleRateLimitWindowChange(60, 60)
    const info = await publicReadLimiter.getKey(ip)
    expect(info?.totalHits).toBe(1)
  })

  it('c) 最后观测窗口经政策读刷新（handler 回退不再恒 60）', async () => {
    const injected = mockPolicyService({ publicReadMax: 55, windowSec: 300 })
    setSharedRateLimitProtectionService(injected as never)
    await getEffectiveRateLimitSnapshot()
    const observed = getLastObservedRateLimitWindow()
    expect(observed.windowSec).toBe(300)
    expect(observed.max).toBe(55)
  })
})

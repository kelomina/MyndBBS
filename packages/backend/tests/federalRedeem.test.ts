import { FederalCaptchaService } from '../src/application/identity/FederalCaptchaService'
import { AuthApplicationService } from '../src/application/identity/AuthApplicationService'
import { CaptchaChallenge } from '../src/domain/identity/CaptchaChallenge'
import type { BehaviorSample } from '../src/domain/identity/FederalGeometry'
import {
  federalRedeemStore,
  verifyFederalRedeem,
  getFederalRedeemTtlSec,
} from '../src/lib/federalRedeem'
import { verifyUnlockToken } from '../src/lib/unlockToken'
import { unlockCaptcha } from '../src/controllers/captcha'

function makeCaptchaRepo() {
  const store = new Map<string, CaptchaChallenge>()
  return {
    store,
    async findById(id: string) {
      return store.get(id) ?? null
    },
    async save(ch: CaptchaChallenge) {
      store.set(ch.id, ch)
    },
    async delete(id: string) {
      if (!store.has(id)) throw new Error('RecordNotFound')
      store.delete(id)
    },
    async updateAttempts(id: string, attempts: number) {
      const ch = store.get(id)
      if (!ch) throw new Error('RecordNotFound')
      const current = ch.attempts
      for (let i = current; i < attempts; i++) ch.incrementAttempts()
    },
    async deleteManyFederalForTest() {
      let n = 0
      for (const [id, ch] of [...store.entries()]) {
        if (ch.challengeKind === 'geometry' || ch.challengeKind === 'pow') {
          store.delete(id)
          n += 1
        }
      }
      return n
    },
  }
}

function humanSamples(count: number, durationMs: number): BehaviorSample[] {
  const samples: BehaviorSample[] = []
  for (let i = 0; i < count; i++) {
    samples.push({
      t: Math.round((durationMs * i) / (count - 1)),
      x: i * 12 + Math.sin(i * 0.9) * 4,
      y: 100 + Math.sin(i * 1.1) * 12 + (i % 3) * 2,
    })
  }
  return samples
}

function makeUnlockReq(body: Record<string, unknown>, ip: string): never {
  return {
    body,
    headers: {},
    ip,
    socket: { remoteAddress: ip },
  } as never
}

function makeUnlockRes(): {
  statusCode: number
  body: unknown
  status(code: number): unknown
  json(data: unknown): unknown
} {
  const res: {
    statusCode: number
    body: unknown
    status(code: number): unknown
    json(data: unknown): unknown
  } = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(data: unknown) {
      res.body = data
      return res
    },
  }
  return res
}

async function callUnlock(
  body: Record<string, unknown>,
  ip: string,
): Promise<{ statusCode: number; body: unknown }> {
  const req = makeUnlockReq(body, ip)
  const res = makeUnlockRes()
  await unlockCaptcha(req as never, res as never)
  return { statusCode: (res as { statusCode: number }).statusCode, body: res.body }
}

describe('Federal redeem one-time credential (v1.0.2, de-H2)', () => {
  const TEST_IP = '203.0.113.7'
  const OTHER_IP = '198.51.100.9'

  beforeEach(async () => {
    process.env.NODE_ENV = 'test'
    delete process.env.TEST_FEDERAL_REDEEM_SEC
    await federalRedeemStore.resetForTest()
  })

  afterEach(async () => {
    delete process.env.TEST_FEDERAL_REDEEM_SEC
    await federalRedeemStore.resetForTest()
  })

  it('issues redeem on geometry verify success and exchanges unlockToken (success path)', async () => {
    const repo = makeCaptchaRepo()
    const service = new FederalCaptchaService({ captchaChallengeRepository: repo as never })
    const issued = await service.issueGeometry({
      geometryLevel: 1,
      strength: 'low',
      timeoutSec: 60,
      strictTimeoutSec: 60,
      testFixed: true,
    })
    const slot = issued.perm.indexOf(issued.targetHour)
    const micro = slot * 130
    const verified = await service.verifyGeometry(issued.id, micro, [], TEST_IP)
    expect(typeof verified.redeemToken).toBe('string')
    expect(verified.redeemToken.length).toBeGreaterThan(20)
    expect(verified.redeemExpiresInSec).toBe(getFederalRedeemTtlSec())
    expect(verified.redeemExpiresAt.getTime()).toBeGreaterThan(Date.now())
    // challenge 行已删（原子），二次 verify 必失败
    expect(await repo.findById(issued.id)).toBeNull()
    // redeem 载荷绑定 captchaId+kind+ip
    const payload = verifyFederalRedeem(verified.redeemToken)
    expect(payload).not.toBeNull()
    expect(payload?.captchaId).toBe(issued.id)
    expect(payload?.kind).toBe('geometry')
    expect(payload?.ip).toBe(TEST_IP)
    // 服务端记录存在（一证未用）
    expect(await federalRedeemStore.has(verified.jti)).toBe(true)
    // /unlock 凭 redeemToken+kind 兑换 unlockToken
    const result = await callUnlock(
      { redeemToken: verified.redeemToken, kind: 'geometry' },
      TEST_IP,
    )
    expect(result.statusCode).toBe(200)
    const body = result.body as Record<string, unknown>
    expect(typeof body['unlockToken']).toBe('string')
    expect(typeof body['expiresAt']).toBe('string')
    // unlockToken 可验且绑定同 IP（豁免 15 分钟快照语义由 signUnlockToken 保证，此处仅断 IP/typ）
    const unlockPayload = verifyUnlockToken(body['unlockToken'] as string)
    expect(unlockPayload).not.toBeNull()
    expect(unlockPayload?.ip).toBe(TEST_IP)
  })

  it('issues redeem on pow verify success and exchanges unlockToken', async () => {
    const repo = makeCaptchaRepo()
    const service = new FederalCaptchaService({ captchaChallengeRepository: repo as never })
    const issued = await service.issuePow({ powBits: 8, testFixed: true })
    const verified = await service.verifyPow(issued.id, '13', TEST_IP)
    expect(typeof verified.redeemToken).toBe('string')
    expect(await repo.findById(issued.id)).toBeNull()
    const payload = verifyFederalRedeem(verified.redeemToken)
    expect(payload?.kind).toBe('pow')
    expect(payload?.ip).toBe(TEST_IP)
    const result = await callUnlock({ redeemToken: verified.redeemToken, kind: 'pow' }, TEST_IP)
    expect(result.statusCode).toBe(200)
    expect((result.body as Record<string, unknown>)['unlockToken']).toBeDefined()
  })

  it('rejects replay: same redeemToken second exchange is 400 ERR_VERIFICATION_FAILED', async () => {
    const repo = makeCaptchaRepo()
    const service = new FederalCaptchaService({ captchaChallengeRepository: repo as never })
    const issued = await service.issueGeometry({
      geometryLevel: 1,
      strength: 'low',
      timeoutSec: 60,
      strictTimeoutSec: 60,
      testFixed: true,
    })
    const slot = issued.perm.indexOf(issued.targetHour)
    const verified = await service.verifyGeometry(issued.id, slot * 130, [], TEST_IP)
    const first = await callUnlock({ redeemToken: verified.redeemToken, kind: 'geometry' }, TEST_IP)
    expect(first.statusCode).toBe(200)
    const second = await callUnlock(
      { redeemToken: verified.redeemToken, kind: 'geometry' },
      TEST_IP,
    )
    expect(second.statusCode).toBe(400)
    expect(second.body).toEqual({ success: false, error: 'ERR_VERIFICATION_FAILED' })
    // 服务端记录已消费
    expect(await federalRedeemStore.has(verified.jti)).toBe(false)
  })

  it('rejects cross-kind impersonation and unsolved captchaId with unified 400', async () => {
    const repo = makeCaptchaRepo()
    const service = new FederalCaptchaService({ captchaChallengeRepository: repo as never })
    const geo = await service.issueGeometry({
      geometryLevel: 1,
      strength: 'low',
      timeoutSec: 60,
      strictTimeoutSec: 60,
      testFixed: true,
    })
    const geoSlot = geo.perm.indexOf(geo.targetHour)
    const geoVerified = await service.verifyGeometry(geo.id, geoSlot * 130, [], TEST_IP)
    // 跨 kind：geometry 凭证冒充 pow
    const cross = await callUnlock({ redeemToken: geoVerified.redeemToken, kind: 'pow' }, TEST_IP)
    expect(cross.statusCode).toBe(400)
    expect(cross.body).toEqual({ success: false, error: 'ERR_VERIFICATION_FAILED' })
    // 跨 IP：同凭证换 IP 出示
    const crossIp = await callUnlock(
      { redeemToken: geoVerified.redeemToken, kind: 'geometry' },
      OTHER_IP,
    )
    expect(crossIp.statusCode).toBe(400)
    expect(crossIp.body).toEqual({ success: false, error: 'ERR_VERIFICATION_FAILED' })
    // 未解题 captchaId（无凭证）直接兑换：缺 redeemToken 即 400（统一码，不泄露是否存在）
    const unsolved = await service.issuePow({ powBits: 8, testFixed: true })
    const noRedeem = await callUnlock({ captchaId: unsolved.id, kind: 'pow' }, TEST_IP)
    expect(noRedeem.statusCode).toBe(400)
    expect(noRedeem.body).toEqual({ success: false, error: 'ERR_VERIFICATION_FAILED' })
    // 旧路径冒充：联邦 geometry 经 drag 三件套+kind geometry 走旧 unlock 即 400
    const legacyKind = await callUnlock(
      {
        captchaId: unsolved.id,
        kind: 'geometry',
        dragPath: [{ x: 0, y: 0, t: 0 }],
        totalDragTime: 1000,
        finalPosition: 120,
      },
      TEST_IP,
    )
    expect(legacyKind.statusCode).toBe(400)
    expect(legacyKind.body).toEqual({ success: false, error: 'ERR_VERIFICATION_FAILED' })
    // 篡改凭证：末位翻转签名必失败
    const tampered =
      geoVerified.redeemToken.slice(0, -1) + (geoVerified.redeemToken.slice(-1) === 'a' ? 'b' : 'a')
    const bad = await callUnlock({ redeemToken: tampered, kind: 'geometry' }, TEST_IP)
    expect(bad.statusCode).toBe(400)
    expect(bad.body).toEqual({ success: false, error: 'ERR_VERIFICATION_FAILED' })
  })

  it('rejects expired redeem with unified 400 (short TTL)', async () => {
    process.env.TEST_FEDERAL_REDEEM_SEC = '1'
    const repo = makeCaptchaRepo()
    const service = new FederalCaptchaService({ captchaChallengeRepository: repo as never })
    const issued = await service.issuePow({ powBits: 8, testFixed: true })
    const verified = await service.verifyPow(issued.id, '13', TEST_IP)
    expect(verified.redeemExpiresInSec).toBe(1)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    const expired = await callUnlock({ redeemToken: verified.redeemToken, kind: 'pow' }, TEST_IP)
    expect(expired.statusCode).toBe(400)
    expect(expired.body).toEqual({ success: false, error: 'ERR_VERIFICATION_FAILED' })
  }, 10000)

  it('allows only one winner on concurrent double redeem (anti double-spend)', async () => {
    const repo = makeCaptchaRepo()
    const service = new FederalCaptchaService({ captchaChallengeRepository: repo as never })
    const issued = await service.issueGeometry({
      geometryLevel: 1,
      strength: 'low',
      timeoutSec: 60,
      strictTimeoutSec: 60,
      testFixed: true,
    })
    const slot = issued.perm.indexOf(issued.targetHour)
    const verified = await service.verifyGeometry(issued.id, slot * 130, [], TEST_IP)
    const [a, b] = await Promise.all([
      callUnlock({ redeemToken: verified.redeemToken, kind: 'geometry' }, TEST_IP),
      callUnlock({ redeemToken: verified.redeemToken, kind: 'geometry' }, TEST_IP),
    ])
    const codes = [a.statusCode, b.statusCode].sort()
    expect(codes).toEqual([200, 400])
    const failed = a.statusCode === 400 ? a : b
    expect(failed.body).toEqual({ success: false, error: 'ERR_VERIFICATION_FAILED' })
    const succeeded = a.statusCode === 200 ? a : b
    expect((succeeded.body as Record<string, unknown>)['unlockToken']).toBeDefined()
  })

  it('keeps legacy slider/unlock three-piece compatible (strength snapshot unchanged)', async () => {
    const repo = makeCaptchaRepo()
    const authService = new AuthApplicationService({
      captchaChallengeRepository: repo,
    } as never)
    const created = CaptchaChallenge.create({
      id: 'slider-legacy-1',
      targetPosition: 120,
      verified: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      strength: 'low',
      challengeKind: 'slider',
      challengeData: null,
      attempts: 0,
    })
    await repo.save(created)
    const dragPath = []
    for (let i = 0; i <= 20; i++) {
      dragPath.push({ x: Math.round((120 * i) / 20), y: 50 + Math.sin(i * 0.7) * 8, t: i * 60 })
    }
    const result = await authService.verifyAndConsumeForUnlock(
      'slider-legacy-1',
      dragPath,
      1200,
      120,
    )
    expect(result.strength).toBe('low')
    expect(await repo.findById('slider-legacy-1')).toBeNull()
    // 联邦 geometry 经旧 slider 直兑必拒（kind 守卫，防旧滑块绕过）
    const geoChallenge = CaptchaChallenge.create({
      id: 'geo-reject-1',
      targetPosition: 0,
      verified: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      strength: 'low',
      challengeKind: 'geometry',
      challengeData: { perm: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], targetHour: 3 },
      attempts: 0,
    })
    await repo.save(geoChallenge)
    await expect(
      authService.verifyAndConsumeForUnlock('geo-reject-1', dragPath, 1200, 120),
    ).rejects.toThrow()
    // 人类样本形状仍复用（行为正交：强度仅管容差/耗时/方差，不管 redeem TTL/豁免）
    expect(humanSamples(12, 1200)).toHaveLength(12)
  })
})

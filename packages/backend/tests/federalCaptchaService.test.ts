import { FederalCaptchaService } from '../src/application/identity/FederalCaptchaService'
import { CaptchaChallenge } from '../src/domain/identity/CaptchaChallenge'
import type { BehaviorSample } from '../src/domain/identity/FederalGeometry'

function makeRepo() {
  const store = new Map<string, CaptchaChallenge>()
  return {
    store,
    async findById(id: string) {
      return store.get(id) ?? null
    },
    async save(ch: CaptchaChallenge) {
      // 联邦行需持久化 kind/data/attempts（内存 mock 按 toDomain 语义回填）
      store.set(ch.id, ch)
    },
    async delete(id: string) {
      if (!store.has(id)) throw new Error('RecordNotFound')
      store.delete(id)
    },
    async updateAttempts(id: string, attempts: number) {
      const ch = store.get(id)
      if (!ch) throw new Error('RecordNotFound')
      // 通过 incrementAttempts 语义同步（直接改 props 次数）
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

describe('FederalCaptchaService issue/verify', () => {
  let repo: ReturnType<typeof makeRepo>
  let service: FederalCaptchaService

  beforeEach(() => {
    repo = makeRepo()
    service = new FederalCaptchaService({ captchaChallengeRepository: repo as never })
  })

  it('issues slider with crypto RNG and verifies with drag payload (federal slider)', async () => {
    const issued = await service.issueSlider('low')
    expect(issued.id).toBeTruthy()
    const stored = await repo.findById(issued.id)
    expect(stored?.challengeKind).toBe('slider')
    // 联邦 slider 复用 drag 载荷：构造类人轨迹通过
    const target = stored?.targetPosition ?? 120
    const dragPath = []
    for (let i = 0; i <= 20; i++) {
      dragPath.push({ x: Math.round((target * i) / 20), y: 50 + Math.sin(i * 0.7) * 8, t: i * 60 })
    }
    await service.verifySliderFederal(issued.id, dragPath, 1200, target)
    expect(await repo.findById(issued.id)).toBeNull()
  })

  it('rejects kind mismatch (slider row via geometry verify)', async () => {
    const issued = await service.issueSlider('low')
    await expect(service.verifyGeometry(issued.id, 65, humanSamples(12, 1200))).rejects.toThrow()
  })

  it('issues geometry with perm[12]+targetHour and verifies semantic hit', async () => {
    const issued = await service.issueGeometry({
      geometryLevel: 1,
      strength: 'low',
      timeoutSec: 10,
      strictTimeoutSec: 15,
      testFixed: false,
    })
    expect(issued.perm).toHaveLength(12)
    expect(issued.targetHour).toBeGreaterThanOrEqual(0)
    // 目标槽中心微槽 = slot*130（round 口径）
    const slot = issued.perm.indexOf(issued.targetHour)
    const micro = slot * 130
    await service.verifyGeometry(issued.id, micro, humanSamples(12, 1200))
    expect(await repo.findById(issued.id)).toBeNull()
  })

  it('enforces 10 attempts limit then deletes row', async () => {
    const issued = await service.issueGeometry({
      geometryLevel: 1,
      strength: 'low',
      timeoutSec: 60,
      strictTimeoutSec: 60,
      testFixed: false,
    })
    // 找一个必错的 micro（读数 != target）
    const wrongSlot = (issued.perm.indexOf(issued.targetHour) + 1) % 12
    const wrongMicro = wrongSlot * 130
    for (let i = 0; i < 10; i++) {
      await expect(
        service.verifyGeometry(issued.id, wrongMicro, humanSamples(12, 1200)),
      ).rejects.toThrow()
    }
    // 第 11 次：行已删（超限作废），一律 400 语义（此处为 ERR_INVALID_CAPTCHA/TOO_MANY）
    await expect(
      service.verifyGeometry(issued.id, wrongMicro, humanSamples(12, 1200)),
    ).rejects.toThrow()
    expect(await repo.findById(issued.id)).toBeNull()
  })

  it('second verify after success fails (atomic delete, mutual exclusion)', async () => {
    const issued = await service.issueGeometry({
      geometryLevel: 1,
      strength: 'low',
      timeoutSec: 60,
      strictTimeoutSec: 60,
      testFixed: false,
    })
    const slot = issued.perm.indexOf(issued.targetHour)
    const micro = slot * 130
    await service.verifyGeometry(issued.id, micro, humanSamples(12, 1200))
    await expect(service.verifyGeometry(issued.id, micro, humanSamples(12, 1200))).rejects.toThrow()
  })

  it('issues pow with hex32+bits and verifies single-hash nonce', async () => {
    const issued = await service.issuePow({ powBits: 8, testFixed: true })
    expect(issued.challengeHex).toMatch(/^[0-9a-f]{32}$/)
    expect(issued.bits).toBe(8)
    // 固定解 nonce=0 单哈希可过（见 federalPow.test.ts 向量）
    await service.verifyPow(issued.id, '0')
    expect(await repo.findById(issued.id)).toBeNull()
  })

  it('rejects tampered pow nonce and prevents replay (delete anti-replay)', async () => {
    const issued = await service.issuePow({ powBits: 16, testFixed: false })
    await expect(service.verifyPow(issued.id, 'not-a-valid-nonce-xyz')).rejects.toThrow()
    // 失败不删（允许重试至过期）
    expect(await repo.findById(issued.id)).not.toBeNull()
  })

  it('supports testFixed geometry deterministic solution', async () => {
    process.env.NODE_ENV = 'test'
    const issued = await service.issueGeometry({
      geometryLevel: 1,
      strength: 'low',
      timeoutSec: 10,
      strictTimeoutSec: 15,
      testFixed: true,
    })
    expect(issued.perm).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    const slot = issued.perm.indexOf(issued.targetHour)
    const micro = slot * 130
    // testFixed 行拖拽豁免：空行为亦可过（仍原子消费）
    await service.verifyGeometry(issued.id, micro, [])
    expect(await repo.findById(issued.id)).toBeNull()
  })
})

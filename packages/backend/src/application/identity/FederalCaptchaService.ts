/**
 * 应用服务：FederalCaptchaService
 *
 * 联邦验证题颁发与校验（API-SPEC-TAG-CAPTCHA-NOTIFY v1.0.0 + 演示批准增量 02:00）：
 * - 颁发：服务端权威选型（effectiveKind），RNG 禁 Math.random（crypto.randomInt/randomBytes/randomUUID）
 * - 几何：小时钟 perm[12] + targetHour + issuedAt；校验语义命中（low/normal）/严格加中心偏差≤30 + 行为重算
 * - PoW：challengeHex(128bit hex32) + bits；单哈希验前导零 + 删行防重放 + 后端≤50ms
 * - 滑块联邦态：复用现有 drag 载荷 + 强度快照（正交），与旧 unlock/发帖 consume 互斥先到先得
 * - 强度正交：low/normal/strict 只管容差耗时方差（滑块/几何行为），不管题型难度（bits/level）
 * - 测试钩子（NODE_ENV=test 限定，生产不可达/404）：
 *   testFixedFederalGeometry（固定 perm 身份 + targetHour + 拖拽豁免，仍原子消费）
 *   testFixedFederalPow（固定 challengeHex + bits 覆盖 8 + 预计算 nonce 单哈希，仍删行防重放）
 *   X-Test-Reset-Federal（清调用方 IP 联邦颁发桶 + 联邦挑战行，与 X-Test-Reset-RateLimit 独立）
 */
import { randomBytes, randomInt, randomUUID as uuidv4 } from 'crypto'
import type { ICaptchaChallengeRepository } from '../../domain/identity/ICaptchaChallengeRepository'
import {
  CaptchaChallenge,
  CAPTCHA_TARGET_RANGE,
  type CaptchaStrength,
} from '../../domain/identity/CaptchaChallenge'
import {
  generatePerm,
  generateTargetHour,
  verifyGeometryBehavior,
  verifyGeometryReading,
  isValidMicroSlot,
  isValidBehaviorSamples,
  type BehaviorSample,
} from '../../domain/identity/FederalGeometry'
import { isValidNonce, verifyPowNonce, isValidChallengeHex } from '../../lib/federalPow'
import { SvgCaptchaGenerator } from './SvgCaptchaGenerator'

export type FederalKind = 'slider' | 'geometry' | 'pow'

export interface FederalCaptchaServiceOptions {
  captchaChallengeRepository: ICaptchaChallengeRepository
}

const FEDERAL_EXPIRES_SEC = 300

function expiresAtFederal(): Date {
  return new Date(Date.now() + FEDERAL_EXPIRES_SEC * 1000)
}

function normalizeStrength(value: unknown, fallback: CaptchaStrength = 'low'): CaptchaStrength {
  if (value === 'low' || value === 'normal' || value === 'strict') return value
  return fallback
}

function getTestFixedFlag(body: unknown): boolean {
  if (process.env.NODE_ENV !== 'test') return false
  if (body !== null && typeof body === 'object') {
    const rec = body as Record<string, unknown>
    if (rec.testFixed === 1 || rec.testFixed === '1' || rec.testFixed === true) return true
  }
  return false
}

function getTestFixedQuery(query: unknown): boolean {
  if (process.env.NODE_ENV !== 'test') return false
  if (query !== null && typeof query === 'object') {
    const rec = query as Record<string, unknown>
    if (rec.testFixed === '1' || rec.testFixed === 1 || rec.testFixed === true) return true
  }
  return false
}

export const TEST_FEDERAL_DEFAULTS = {
  geometryTargetHour: 3,
  geometryPerm: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  powChallengeHex: '0123456789abcdef0123456789abcdef',
  powBits: 8,
  // 预计算 nonce（SHA256(challengeHex+nonce) 前导零 ≥8bits，单哈希可过；见 tests/federalPow.fixed.test.ts 生成口径）
  powNonce: '0',
} as const

export class FederalCaptchaService {
  constructor(private readonly opts: FederalCaptchaServiceOptions) {}

  public isTestFixedBody(body: unknown): boolean {
    return getTestFixedFlag(body)
  }

  public isTestFixedQuery(query: unknown): boolean {
    return getTestFixedQuery(query)
  }

  // ── 颁发 ──

  public async issueSlider(strength: CaptchaStrength): Promise<{ id: string; image: string }> {
    const snapshot = normalizeStrength(strength, 'low')
    const range = CAPTCHA_TARGET_RANGE[snapshot]
    // RNG 禁 Math.random：联邦路径经 crypto.randomInt
    const span = range.max - range.min + 1
    const targetPosition = randomInt(span) + range.min
    const challenge = CaptchaChallenge.create({
      id: uuidv4(),
      targetPosition,
      verified: false,
      expiresAt: expiresAtFederal(),
      strength: snapshot,
      challengeKind: 'slider',
      challengeData: null,
      attempts: 0,
    })
    await this.opts.captchaChallengeRepository.save(challenge)
    const image = SvgCaptchaGenerator.generateImage(targetPosition)
    return { id: challenge.id, image }
  }

  public async issueGeometry(params: {
    geometryLevel: number
    strength: CaptchaStrength
    timeoutSec: number
    strictTimeoutSec: number
    testFixed: boolean
  }): Promise<{
    id: string
    perm: number[]
    targetHour: number
    geometryLevel: number
    strength: CaptchaStrength
  }> {
    const strength = normalizeStrength(params.strength, 'low')
    const geometryLevel =
      Number.isInteger(params.geometryLevel) &&
      params.geometryLevel >= 1 &&
      params.geometryLevel <= 3
        ? params.geometryLevel
        : 1
    let perm: number[]
    let targetHour: number
    let testFixedStored = false
    if (params.testFixed && process.env.NODE_ENV === 'test') {
      perm = [...TEST_FEDERAL_DEFAULTS.geometryPerm]
      const envRaw = process.env.TEST_FEDERAL_TARGET_HOUR
      const envParsed = envRaw ? Number(envRaw) : NaN
      targetHour =
        Number.isInteger(envParsed) && envParsed >= 0 && envParsed <= 11
          ? envParsed
          : TEST_FEDERAL_DEFAULTS.geometryTargetHour
      testFixedStored = true
    } else {
      perm = generatePerm()
      targetHour = generateTargetHour()
    }
    const issuedAt = new Date().toISOString()
    const challengeData: Record<string, unknown> = {
      perm,
      targetHour,
      issuedAt,
      geometryLevel,
      timeoutSec: params.timeoutSec,
      strictTimeoutSec: params.strictTimeoutSec,
    }
    if (testFixedStored) challengeData.testFixed = true
    const challenge = CaptchaChallenge.create({
      id: uuidv4(),
      targetPosition: 0,
      verified: false,
      expiresAt: expiresAtFederal(),
      strength,
      challengeKind: 'geometry',
      challengeData,
      attempts: 0,
    })
    await this.opts.captchaChallengeRepository.save(challenge)
    return { id: challenge.id, perm, targetHour, geometryLevel, strength }
  }

  public async issuePow(params: {
    powBits: number
    testFixed: boolean
  }): Promise<{ id: string; challengeHex: string; bits: number; expiresAt: Date }> {
    let challengeHex: string
    let bits: number
    let testFixedStored = false
    if (params.testFixed && process.env.NODE_ENV === 'test') {
      const envChallenge = process.env.TEST_FEDERAL_CHALLENGE
      challengeHex =
        typeof envChallenge === 'string' && /^[0-9a-fA-F]{32}$/.test(envChallenge)
          ? envChallenge.toLowerCase()
          : TEST_FEDERAL_DEFAULTS.powChallengeHex
      bits = TEST_FEDERAL_DEFAULTS.powBits
      testFixedStored = true
    } else {
      challengeHex = randomBytes(16).toString('hex')
      bits =
        Number.isInteger(params.powBits) && params.powBits >= 8 && params.powBits <= 24
          ? params.powBits
          : 16
    }
    const challengeData: Record<string, unknown> = { challengeHex, bits }
    if (testFixedStored) challengeData.testFixed = true
    const challenge = CaptchaChallenge.create({
      id: uuidv4(),
      targetPosition: 0,
      verified: false,
      expiresAt: expiresAtFederal(),
      strength: 'low',
      challengeKind: 'pow',
      challengeData,
      attempts: 0,
    })
    await this.opts.captchaChallengeRepository.save(challenge)
    return { id: challenge.id, challengeHex, bits, expiresAt: challenge.expiresAt }
  }

  // ── 校验（原子消费，与滑块/发帖 consume 互斥先到先得；失败统一对外 ERR_VERIFICATION_FAILED）──

  public async verifyGeometry(
    id: string,
    microSlot: unknown,
    behaviorSamples: unknown,
  ): Promise<{ strength: CaptchaStrength }> {
    const challenge = await this.opts.captchaChallengeRepository.findById(id)
    if (!challenge) throw new Error('ERR_INVALID_CAPTCHA')
    if (challenge.challengeKind !== 'geometry') throw new Error('ERR_INVALID_CAPTCHA')
    if (challenge.expiresAt.getTime() <= Date.now()) {
      try {
        await this.opts.captchaChallengeRepository.delete(id)
      } catch {
        // ignore
      }
      throw new Error('ERR_CAPTCHA_EXPIRED')
    }
    if (challenge.attempts >= 10) {
      try {
        await this.opts.captchaChallengeRepository.delete(id)
      } catch {
        // ignore
      }
      throw new Error('ERR_TOO_MANY_ATTEMPTS')
    }
    const data = (challenge.challengeData ?? {}) as Record<string, unknown>
    const perm = data.perm
    const targetHour = data.targetHour
    const timeoutSec =
      typeof data.timeoutSec === 'number' && Number.isInteger(data.timeoutSec)
        ? (data.timeoutSec as number)
        : 10
    const strictTimeoutSec =
      typeof data.strictTimeoutSec === 'number' && Number.isInteger(data.strictTimeoutSec)
        ? (data.strictTimeoutSec as number)
        : 15
    const isTestFixedRow = data.testFixed === true && process.env.NODE_ENV === 'test'
    const strength = challenge.strength

    const fail = async (internal: string): Promise<never> => {
      const nextAttempts = challenge.attempts + 1
      try {
        await this.opts.captchaChallengeRepository.updateAttempts(id, nextAttempts)
        if (nextAttempts >= 10) {
          try {
            await this.opts.captchaChallengeRepository.delete(id)
          } catch {
            // ignore
          }
        }
      } catch {
        // 行已消失（并发落败）→ 统一 400
      }
      throw new Error(internal)
    }

    if (!isValidMicroSlot(microSlot)) {
      await fail('ERR_INVALID_MICRO_SLOT')
    }
    const micro = microSlot as number
    // testFixed 行：拖拽豁免（跳行为 + 中心），仅语义命中，仍走原子消费
    if (isTestFixedRow) {
      try {
        verifyGeometryReading(perm as number[], targetHour as number, micro, 'low')
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'ERR_INVALID_POSITION'
        await fail(msg)
      }
      try {
        await this.opts.captchaChallengeRepository.delete(id)
      } catch {
        throw new Error('ERR_INVALID_CAPTCHA')
      }
      const after = await this.opts.captchaChallengeRepository.findById(id).catch(() => null)
      if (after) throw new Error('ERR_INVALID_CAPTCHA')
      return { strength }
    }

    if (!isValidBehaviorSamples(behaviorSamples)) {
      await fail('ERR_AUTOMATION_DETECTED_INVALID_PATH')
    }
    const samples = behaviorSamples as BehaviorSample[]
    try {
      verifyGeometryReading(perm as number[], targetHour as number, micro, strength)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'ERR_INVALID_POSITION'
      await fail(msg)
    }
    try {
      verifyGeometryBehavior(samples, strength, timeoutSec, strictTimeoutSec)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'ERR_AUTOMATION_DETECTED_INVALID_PATH'
      await fail(msg)
    }
    try {
      await this.opts.captchaChallengeRepository.delete(id)
    } catch {
      throw new Error('ERR_INVALID_CAPTCHA')
    }
    const after = await this.opts.captchaChallengeRepository.findById(id).catch(() => null)
    if (after) throw new Error('ERR_INVALID_CAPTCHA')
    return { strength }
  }

  public async verifyPow(id: string, nonce: unknown): Promise<void> {
    const challenge = await this.opts.captchaChallengeRepository.findById(id)
    if (!challenge) throw new Error('ERR_INVALID_CAPTCHA')
    if (challenge.challengeKind !== 'pow') throw new Error('ERR_INVALID_CAPTCHA')
    if (challenge.expiresAt.getTime() <= Date.now()) {
      try {
        await this.opts.captchaChallengeRepository.delete(id)
      } catch {
        // ignore
      }
      throw new Error('ERR_CAPTCHA_EXPIRED')
    }
    if (!isValidNonce(nonce)) throw new Error('ERR_INVALID_NONCE')
    const data = (challenge.challengeData ?? {}) as Record<string, unknown>
    const challengeHex = data.challengeHex
    const bits = data.bits
    if (!isValidChallengeHex(challengeHex)) throw new Error('ERR_INVALID_CHALLENGE')
    if (typeof bits !== 'number' || !Number.isInteger(bits) || bits < 8 || bits > 24) {
      throw new Error('ERR_INVALID_CHALLENGE')
    }
    const ok = verifyPowNonce(challengeHex as string, nonce as string, bits as number)
    if (!ok) throw new Error('ERR_INVALID_NONCE')
    try {
      await this.opts.captchaChallengeRepository.delete(id)
    } catch {
      throw new Error('ERR_INVALID_CAPTCHA')
    }
    const after = await this.opts.captchaChallengeRepository.findById(id).catch(() => null)
    if (after) throw new Error('ERR_INVALID_CAPTCHA')
  }

  public async verifySliderFederal(
    id: string,
    dragPath: unknown,
    totalDragTime: unknown,
    finalPosition: unknown,
  ): Promise<{ strength: CaptchaStrength }> {
    const challenge = await this.opts.captchaChallengeRepository.findById(id)
    if (!challenge) throw new Error('ERR_INVALID_CAPTCHA')
    if (challenge.challengeKind !== 'slider') throw new Error('ERR_INVALID_CAPTCHA')
    if (challenge.expiresAt.getTime() <= Date.now()) {
      try {
        await this.opts.captchaChallengeRepository.delete(id)
      } catch {
        // ignore
      }
      throw new Error('ERR_CAPTCHA_EXPIRED')
    }
    // testFixed 旁路（仅 test）：finalPosition 容差 ±1 + 最小轨迹豁免，仍原子消费（沿用旧 unlock 语义）
    if (process.env.NODE_ENV === 'test') {
      const fixedTargetRaw = process.env.TEST_CAPTCHA_TARGET
      const fixedTarget = fixedTargetRaw ? Number(fixedTargetRaw) : 120
      if (
        Number.isInteger(fixedTarget) &&
        typeof finalPosition === 'number' &&
        Math.abs((finalPosition as number) - fixedTarget) <= 1 &&
        challenge.targetPosition === fixedTarget
      ) {
        try {
          await this.opts.captchaChallengeRepository.delete(id)
        } catch {
          throw new Error('ERR_INVALID_CAPTCHA')
        }
        const still = await this.opts.captchaChallengeRepository.findById(id).catch(() => null)
        if (still) throw new Error('ERR_INVALID_CAPTCHA')
        return { strength: challenge.strength }
      }
    }
    if (
      !Array.isArray(dragPath) ||
      typeof totalDragTime !== 'number' ||
      typeof finalPosition !== 'number'
    ) {
      throw new Error('ERR_INVALID_SLIDER_PAYLOAD')
    }
    const formatted = (dragPath as unknown[]).map((p: unknown) => {
      const rec = (p ?? {}) as Record<string, unknown>
      return { x: rec.x, y: rec.y, t: (rec.t ?? rec.time) as number }
    })
    try {
      challenge.verifyTrajectoryForUnlock(
        formatted as { x: number; y: number; t: number }[],
        totalDragTime as number,
        finalPosition as number,
      )
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'ERR_CAPTCHA_EXPIRED') {
        try {
          await this.opts.captchaChallengeRepository.delete(id)
        } catch {
          // ignore
        }
      }
      throw e
    }
    try {
      await this.opts.captchaChallengeRepository.delete(id)
    } catch {
      throw new Error('ERR_INVALID_CAPTCHA')
    }
    const after = await this.opts.captchaChallengeRepository.findById(id).catch(() => null)
    if (after) throw new Error('ERR_INVALID_CAPTCHA')
    return { strength: challenge.strength }
  }
}

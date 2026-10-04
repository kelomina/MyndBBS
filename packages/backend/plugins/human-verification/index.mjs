import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import { normalizeConfig, PURPOSES, selectKind } from './config.mjs'
import { CaptchaChallenge, CAPTCHA_TARGET_RANGE } from './algorithms/slider.mjs'
import {
  generatePerm,
  generateTargetHour,
  isValidBehaviorSamples,
  isValidMicroSlot,
  verifyGeometryReading,
  verifyGeometryBehavior,
} from './algorithms/geometry.mjs'
import { isValidNonce, verifyPowNonce } from './algorithms/pow.mjs'
import { SvgCaptchaGenerator } from './algorithms/image.mjs'

const MAX_CHALLENGES = 1024
const TTL_SEC = 300
const MAX_BYTES = 32 * 1024
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype'])
const invalid = () => {
  throw new Error('ERR_INVALID_HUMAN_VERIFICATION_REQUEST')
}
const record = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value))
const exact = (value, required, optional = []) =>
  record(value) &&
  required.every((key) => Object.hasOwn(value, key)) &&
  Object.keys(value).every((key) => required.includes(key) || optional.includes(key))

// Runtime limits raw streamed bytes. This second guard also protects direct calls,
// rejects non-JSON values and bounds depth before serialization of a parsed DTO.
function boundedJson(value) {
  let budget = MAX_BYTES
  function visit(item, depth) {
    if (--budget < 0 || depth > 12) invalid()
    if (item === null || typeof item === 'boolean') return
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) invalid()
      return
    }
    if (typeof item === 'string') {
      budget -= Buffer.byteLength(item)
      if (budget < 0) invalid()
      return
    }
    if (!Array.isArray(item) && !record(item)) invalid()
    for (const key of Object.keys(item)) {
      if (!Array.isArray(item)) budget -= Buffer.byteLength(key)
      if (FORBIDDEN.has(key) || budget < 0) invalid()
      visit(item[key], depth + 1)
    }
  }
  visit(value, 0)
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_BYTES)
    throw new Error('ERR_PLUGIN_REQUEST_TOO_LARGE')
}
function points(value, stroke = false) {
  return (
    Array.isArray(value) &&
    value.every(
      (point) =>
        exact(point, ['x', 'y', 't'], stroke ? ['s'] : []) &&
        ['x', 'y', 't'].every((key) => Number.isFinite(point[key])) &&
        (!Object.hasOwn(point, 's') || Number.isFinite(point.s)),
    )
  )
}

// A factory creates independent production instances, with no clock/RNG/answer
// injection. Only the default instance is used by the signed worker entry.
export function createHumanVerificationPlugin() {
  let config
  let active = false
  const challenges = new Map()
  const prune = () => {
    const now = Date.now()
    for (const [id, challenge] of challenges) if (challenge.deadline <= now) challenges.delete(id)
  }
  function issue(purpose, input) {
    if (!exact(input, [])) invalid()
    prune()
    if (challenges.size >= MAX_CHALLENGES)
      throw new Error('ERR_HUMAN_VERIFICATION_CAPACITY_EXCEEDED')
    const kind = selectKind(config, purpose)
    const strength = config.sliderStrength
    const deadline = Date.now() + TTL_SEC * 1000
    const challengeId = randomUUID()
    // Never overwrite state even in the extraordinarily unlikely event of collision.
    if (challenges.has(challengeId)) throw new Error('ERR_HUMAN_VERIFICATION_ID_COLLISION')
    let state
    let challenge
    if (kind === 'slider') {
      const range = CAPTCHA_TARGET_RANGE[strength]
      const targetPosition = randomInt(range.min, range.max + 1)
      state = { targetPosition }
      challenge = { kind, image: SvgCaptchaGenerator.generateImage(targetPosition), strength }
    } else if (kind === 'geometry') {
      const perm = generatePerm()
      const targetHour = generateTargetHour()
      const { geometryLevel, timeoutSec, strictTimeoutSec } = config.federal
      state = { perm, targetHour, timeoutSec, strictTimeoutSec }
      challenge = {
        kind,
        puzzleType: 'rotation',
        puzzle: { perm: [...perm], targetHour },
        geometryLevel,
        strength,
        timeoutSec,
        strictTimeoutSec,
      }
    } else if (kind === 'pow') {
      const challengeHex = randomBytes(16).toString('hex')
      const bits = config.federal.powBits
      state = { challengeHex, bits }
      challenge = { kind, challengeHex, bits }
    } else {
      throw new Error('ERR_INVALID_PLUGIN_CONFIG')
    }
    const response = { challengeId, challenge, expiresInSec: TTL_SEC }
    if (Buffer.byteLength(JSON.stringify(response), 'utf8') > MAX_BYTES)
      throw new Error('ERR_PLUGIN_RESPONSE_TOO_LARGE')
    challenges.set(challengeId, { purpose, kind, strength, deadline, ...state })
    return response
  }
  function verify(purpose, input) {
    if (
      !exact(input, ['challengeId', 'solution']) ||
      typeof input.challengeId !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
        input.challengeId,
      ) ||
      !record(input.solution)
    )
      invalid()
    prune()
    const state = challenges.get(input.challengeId)
    if (!state || state.purpose !== purpose) return { verified: false, assurance: 'low' }
    // Synchronous take before any algorithm work: even direct concurrent worker
    // calls have one attempt. Core Redis, not this Map, owns proof atomicity.
    challenges.delete(input.challengeId)
    const assurance = state.kind === 'pow' ? 'low' : state.strength
    const fail = { verified: false, assurance }
    const solution = input.solution
    try {
      if (state.kind === 'slider') {
        if (
          !exact(solution, ['dragPath', 'totalDragTime', 'finalPosition']) ||
          !points(solution.dragPath) ||
          !Number.isFinite(solution.totalDragTime) ||
          !Number.isFinite(solution.finalPosition)
        )
          return fail
        const challenge = CaptchaChallenge.create({
          id: input.challengeId,
          targetPosition: state.targetPosition,
          verified: false,
          expiresAt: new Date(state.deadline),
          strength: state.strength,
        })
        challenge.verifyTrajectoryForUnlock(
          solution.dragPath,
          solution.totalDragTime,
          solution.finalPosition,
        )
      } else if (state.kind === 'geometry') {
        if (
          !exact(solution, ['microSlot', 'behaviorSamples']) ||
          !isValidMicroSlot(solution.microSlot) ||
          !points(solution.behaviorSamples, true) ||
          !isValidBehaviorSamples(solution.behaviorSamples)
        )
          return fail
        verifyGeometryReading(state.perm, state.targetHour, solution.microSlot, state.strength)
        verifyGeometryBehavior(
          solution.behaviorSamples,
          state.strength,
          state.timeoutSec,
          state.strictTimeoutSec,
        )
      } else if (state.kind === 'pow') {
        if (
          !exact(solution, ['nonce']) ||
          !isValidNonce(solution.nonce) ||
          !verifyPowNonce(state.challengeHex, solution.nonce, state.bits)
        )
          return fail
      } else return fail
    } catch {
      return fail
    }
    // Never allow expensive work to extend the absolute challenge deadline.
    return { verified: Date.now() < state.deadline, assurance }
  }
  return {
    activate(ctx) {
      const candidate = normalizeConfig(ctx.getConfig())
      if (typeof ctx.registerHealthCheck !== 'function')
        throw new Error('ERR_PLUGIN_HEALTH_CHECK_INVALID')
      challenges.clear()
      config = candidate
      active = true
      ctx.registerHealthCheck(async () => {
        if (!active) throw new Error('ERR_HUMAN_VERIFICATION_UNAVAILABLE')
        prune()
      })
    },
    deactivate() {
      active = false
      config = undefined
      challenges.clear()
    },
    handleHumanVerification(request) {
      if (!active) throw new Error('ERR_HUMAN_VERIFICATION_UNAVAILABLE')
      boundedJson(request)
      if (
        !exact(request, ['operation', 'purpose', 'input']) ||
        !PURPOSES.includes(request.purpose) ||
        !record(request.input)
      )
        invalid()
      if (request.operation === 'issue') return issue(request.purpose, request.input)
      if (request.operation === 'verify') return verify(request.purpose, request.input)
      invalid()
    },
  }
}

export default createHumanVerificationPlugin()

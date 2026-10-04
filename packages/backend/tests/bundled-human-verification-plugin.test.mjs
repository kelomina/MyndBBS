import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createHumanVerificationPlugin } from '../plugins/human-verification/index.mjs'
import { normalizeConfig } from '../plugins/human-verification/config.mjs'
import {
  CaptchaChallenge,
  CAPTCHA_STRENGTH_PARAMS,
  CAPTCHA_TARGET_RANGE,
} from '../plugins/human-verification/algorithms/slider.mjs'
import {
  verifyGeometryReading,
  verifyGeometryBehavior,
  GEOMETRY_BEHAVIOR_MIN_POINTS,
  GEOMETRY_BEHAVIOR_MIN_TIME_MS,
  GEOMETRY_BEHAVIOR_MAX_TIME_MS,
} from '../plugins/human-verification/algorithms/geometry.mjs'
import {
  hashPowChallenge,
  countLeadingZeroBits,
  verifyPowNonce,
} from '../plugins/human-verification/algorithms/pow.mjs'

function activated(config = {}) {
  const plugin = createHumanVerificationPlugin()
  let health
  plugin.activate({
    getConfig: () => config,
    registerHealthCheck: (check) => {
      health = check
    },
  })
  return { plugin, health }
}
const issue = (plugin, purpose = 'rateLimitUnlock', input = {}) =>
  plugin.handleHumanVerification({ operation: 'issue', purpose, input })
const verify = (plugin, challengeId, solution, purpose = 'rateLimitUnlock') =>
  plugin.handleHumanVerification({ operation: 'verify', purpose, input: { challengeId, solution } })
const configFor = (kind, strength = 'low') => ({
  sliderStrength: strength,
  federal: { defaultKind: kind, powBits: 8 },
})
function samples(n = 16, total = 600) {
  return Array.from({ length: n }, (_, i) => ({
    t: (i * total) / (n - 1),
    x: (i * i) / 2,
    y: Math.sin(i) * 8,
  }))
}
function solveGeometry(challenge) {
  return {
    microSlot: challenge.puzzle.perm.indexOf(challenge.puzzle.targetHour) * 130,
    behaviorSamples: samples(),
  }
}
function solvePow(challenge) {
  for (let i = 0; i < 1000000; i++)
    if (verifyPowNonce(challenge.challengeHex, String(i), challenge.bits))
      return { nonce: String(i) }
  throw new Error('Random 8-bit challenge unexpectedly unsolved after bounded test search')
}

// Tests exercise pure algorithm boundaries and real random production challenges;
// no environment-based fixed answer or injected clock/RNG hook exists in the plugin.
test('manifest hash/schema defaults and shipped modules are self-contained', () => {
  const root = new URL('../plugins/human-verification/', import.meta.url)
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', root)))
  assert.equal(manifest.apiVersion, 2)
  assert.deepEqual(manifest.capabilities.humanVerification, {
    apiVersion: 1,
    ui: 'ui/challenge.html',
  })
  assert.equal(
    manifest.entrySha256,
    createHash('sha256')
      .update(readFileSync(new URL(manifest.entry, root)))
      .digest('hex'),
  )
  assert.deepEqual(manifest.capabilities.config.schema.default, normalizeConfig())
  assert.deepEqual(manifest.capabilities.routes, [])
  assert.deepEqual(manifest.capabilities.events, [])
  assert.deepEqual(manifest.capabilities.config.secretPaths, [])
  for (const file of [
    'index.mjs',
    'config.mjs',
    ...readdirSync(new URL('algorithms/', root)).map((f) => 'algorithms/' + f),
  ]) {
    const source = readFileSync(new URL(file, root), 'utf8')
    for (const match of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g))
      assert.ok(
        match[1].startsWith('./') || ['node:crypto', 'node:zlib'].includes(match[1]),
        match[1],
      )
    assert.doesNotMatch(
      source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ''),
      /process\.env|TEST_CAPTCHA|testFixed|fetch\(|node:fs|node:http|redis|prisma/i,
    )
  }
})

test('missing config is safe, explicit false is retained, invalid config never coerces', () => {
  const defaults = normalizeConfig()
  assert.deepEqual(defaults.surfaces, {
    registration: true,
    post: true,
    comment: true,
    friendRequest: true,
  })
  assert.deepEqual(defaults.federal, {
    enabled: true,
    kinds: { slider: true, geometry: true, pow: true },
    defaultKind: 'slider',
    geometryLevel: 1,
    powBits: 16,
    timeoutSec: 10,
    strictTimeoutSec: 15,
  })
  assert.equal(defaults.sliderStrength, 'low')
  assert.equal(normalizeConfig({ enabled: false }).enabled, false)
  assert.equal(normalizeConfig({ surfaces: { post: false } }).surfaces.comment, true)
  for (const bad of [
    null,
    [],
    { enabled: 'false' },
    { extra: true },
    { federal: null },
    { sliderStrength: 'easy' },
    { federal: { powBits: '8' } },
    { federal: { powBits: 25 } },
    { federal: { geometryLevel: 0 } },
    { federal: { timeoutSec: 4 } },
    { federal: { strictTimeoutSec: 61 } },
    { federal: { kinds: { sliderEnabled: true } } },
    { federal: { kinds: { slider: false, geometry: false, pow: false } } },
  ])
    assert.throws(() => normalizeConfig(bad), /ERR_INVALID_PLUGIN_CONFIG/)
})

test('four business purposes always slider, explicit federal disable keeps configured strength', () => {
  const { plugin, health } = activated(configFor('pow', 'strict'))
  for (const purpose of ['registration', 'post', 'comment', 'friendRequest']) {
    const result = issue(plugin, purpose)
    assert.equal(result.challenge.kind, 'slider')
    assert.equal(result.challenge.strength, 'strict')
    assert.match(result.challenge.image, /^data:image\/png;base64,/)
    assert.equal(result.expiresInSec, 300)
    assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 32768)
    assert.equal(Object.hasOwn(result.challenge, 'targetPosition'), false)
    const png = Buffer.from(result.challenge.image.split(',')[1], 'base64')
    assert.equal(png.readUInt32BE(16), 318)
    assert.equal(png.readUInt32BE(20), 128)
  }
  assert.equal(issue(plugin).challenge.kind, 'pow')
  const disabled = activated({
    sliderStrength: 'strict',
    federal: { enabled: false, defaultKind: 'pow' },
  }).plugin
  assert.equal(issue(disabled).challenge.kind, 'slider')
  assert.equal(issue(disabled).challenge.strength, 'strict')
  const selected = activated({
    federal: { defaultKind: 'pow', kinds: { pow: false, slider: false } },
  }).plugin
  assert.equal(issue(selected).challenge.kind, 'geometry')
  return health()
})

for (const strength of ['low', 'normal', 'strict']) {
  test(`real geometry verifies at ${strength}, config and returned puzzle cannot alter snapshot`, () => {
    const config = configFor('geometry', strength)
    const { plugin } = activated(config)
    const result = issue(plugin)
    const solution = solveGeometry(result.challenge)
    config.sliderStrength = strength === 'strict' ? 'low' : 'strict'
    config.federal.timeoutSec = 60
    result.challenge.puzzle.perm.fill(99)
    result.challenge.puzzle.targetHour = 99
    assert.deepEqual(verify(plugin, result.challengeId, solution), {
      verified: true,
      assurance: strength,
    })
    assert.equal(verify(plugin, result.challengeId, solution).verified, false)
  })
}

test('same random challenge has one winner, wrong purpose does not burn it, bad answer does', async () => {
  const { plugin } = activated(configFor('geometry'))
  const first = issue(plugin)
  const solution = solveGeometry(first.challenge)
  assert.equal(verify(plugin, first.challengeId, solution, 'registration').verified, false)
  const results = await Promise.all(
    [0, 1].map(() => Promise.resolve().then(() => verify(plugin, first.challengeId, solution))),
  )
  assert.equal(results.filter((r) => r.verified).length, 1)
  const second = issue(plugin)
  assert.equal(
    verify(plugin, second.challengeId, { microSlot: -1, behaviorSamples: samples() }).verified,
    false,
  )
  assert.equal(verify(plugin, second.challengeId, solveGeometry(second.challenge)).verified, false)
})

test('PoW delimiter/MSB fixed vector and randomly issued nonce preserve low assurance', () => {
  const hex = '0123456789abcdef0123456789abcdef'
  assert.equal(hashPowChallenge(hex, '13').toString('hex').slice(0, 8), '0025b120')
  assert.equal(countLeadingZeroBits(hashPowChallenge(hex, '13')), 10)
  assert.equal(verifyPowNonce(hex, '13', 11), false)
  const { plugin } = activated(configFor('pow', 'strict'))
  const result = issue(plugin)
  assert.match(result.challenge.challengeHex, /^[0-9a-f]{32}$/)
  const solution = solvePow(result.challenge)
  assert.deepEqual(verify(plugin, result.challengeId, solution), {
    verified: true,
    assurance: 'low',
  })
  assert.equal(verify(plugin, result.challengeId, solution).verified, false)
  const bad = issue(plugin)
  assert.equal(verify(plugin, bad.challengeId, { nonce: 'x'.repeat(257) }).verified, false)
})

test('RAM 1024 cap, 300 second absolute TTL and lifecycle reset', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1800000000000 })
  const config = configFor('geometry')
  const { plugin } = activated(config)
  const first = issue(plugin)
  for (let i = 1; i < 1024; i++) issue(plugin)
  assert.throws(() => issue(plugin), /ERR_HUMAN_VERIFICATION_CAPACITY_EXCEEDED/)
  t.mock.timers.tick(299999)
  assert.throws(() => issue(plugin), /ERR_HUMAN_VERIFICATION_CAPACITY_EXCEEDED/)
  t.mock.timers.tick(1)
  assert.equal(verify(plugin, first.challengeId, solveGeometry(first.challenge)).verified, false)
  const next = issue(plugin)
  assert.equal(next.expiresInSec, 300)
  const restarted = activated(config).plugin
  assert.equal(verify(restarted, next.challengeId, solveGeometry(next.challenge)).verified, false)
  plugin.deactivate()
  assert.throws(() => issue(plugin), /ERR_HUMAN_VERIFICATION_UNAVAILABLE/)
  plugin.activate({ getConfig: () => config, registerHealthCheck() {} })
  assert.equal(verify(plugin, next.challengeId, solveGeometry(next.challenge)).verified, false)
})

test('entry rejects unknown operations/purpose, policy overrides, non-JSON, excessive UTF8 and depth', () => {
  const { plugin } = activated()
  const call = (request) => plugin.handleHumanVerification(request)
  assert.throws(() => call({ operation: 'ui', purpose: 'post', input: {} }), /ERR_/)
  assert.throws(() => issue(plugin, 'unknown'), /ERR_/)
  assert.throws(() => issue(plugin, 'post', { kind: 'pow' }), /ERR_/)
  assert.throws(() => call({ operation: 'issue', purpose: 'post', input: {}, cookie: 'x' }), /ERR_/)
  assert.throws(() => issue(plugin, 'post', JSON.parse('{"__proto__":{}}')), /ERR_/)
  assert.throws(() => issue(plugin, 'post', { x: NaN }), /ERR_/)
  assert.throws(() => issue(plugin, 'post', { x: '汉'.repeat(11000) }), /ERR_/)
  let deep = {}
  for (let i = 0; i < 14; i++) deep = { x: deep }
  assert.throws(() => issue(plugin, 'post', deep), /ERR_/)
  const cycle = {}
  cycle.x = cycle
  assert.throws(() => issue(plugin, 'post', cycle), /ERR_/)
  const challenge = issue(plugin, 'post')
  assert.equal(
    verify(
      plugin,
      challenge.challengeId,
      { dragPath: [], totalDragTime: 600, finalPosition: 120, strength: 'low' },
      'post',
    ).verified,
    false,
  )
})

for (const strength of ['low', 'normal', 'strict']) {
  test(`original slider ${strength} points/time/position/variance boundaries`, () => {
    const p = CAPTCHA_STRENGTH_PARAMS[strength]
    const path = (n, total) =>
      Array.from({ length: n }, (_, i) => ({
        x: 3 * i * i,
        y: (i % 2) * 10,
        t: (i * total) / (n - 1),
      }))
    const evaluate = (points, duration, position) =>
      CaptchaChallenge.create({
        id: 'unit',
        targetPosition: 120,
        strength,
        verified: false,
        expiresAt: new Date(Date.now() + 10000),
      }).verifyTrajectoryForUnlock(points, duration, position)
    const good = path(p.minPoints, p.minTimeMs)
    assert.doesNotThrow(() => evaluate(good, p.minTimeMs, 120 + p.tolerance))
    assert.throws(
      () => evaluate(good, p.minTimeMs, 120 + p.tolerance + 0.01),
      /ERR_INVALID_POSITION/,
    )
    assert.throws(() => evaluate(good.slice(1), p.minTimeMs, 120), /ERR_AUTOMATION/)
    assert.throws(() => evaluate(good, p.minTimeMs - 1, 120), /ERR_AUTOMATION/)
    assert.throws(() => evaluate(good, p.maxTimeMs + 1, 120), /ERR_AUTOMATION/)
    assert.throws(
      () =>
        evaluate(
          Array.from({ length: 20 }, (_, i) => ({ x: i * 16, y: 0, t: i * 32 })),
          608,
          120,
        ),
      /ERR_AUTOMATION_DETECTED_LINEAR_TRAJECTORY/,
    )
    if (strength === 'strict')
      assert.deepEqual(CAPTCHA_TARGET_RANGE[strength], { min: 60, max: 260 })
  })
}

test('geometry distinct thresholds, center edge, monotonic time, strokes and no weak fallbacks', () => {
  const perm = Array.from({ length: 12 }, (_, i) => i)
  assert.doesNotThrow(() => verifyGeometryReading(perm, 3, 420, 'strict'))
  assert.throws(() => verifyGeometryReading(perm, 3, 421, 'strict'), /ERR_INVALID_POSITION/)
  assert.doesNotThrow(() => verifyGeometryReading(perm, 3, 421, 'normal'))
  for (const strength of ['low', 'normal', 'strict']) {
    const n = GEOMETRY_BEHAVIOR_MIN_POINTS[strength]
    const total = GEOMETRY_BEHAVIOR_MIN_TIME_MS[strength]
    assert.doesNotThrow(() => verifyGeometryBehavior(samples(n, total), strength, 60, 60))
    assert.throws(
      () => verifyGeometryBehavior(samples(n - 1, total), strength, 60, 60),
      /ERR_AUTOMATION/,
    )
    assert.throws(
      () => verifyGeometryBehavior(samples(n, total - 1), strength, 60, 60),
      /ERR_AUTOMATION/,
    )
    assert.throws(
      () =>
        verifyGeometryBehavior(
          samples(n, GEOMETRY_BEHAVIOR_MAX_TIME_MS[strength] + 1),
          strength,
          60,
          60,
        ),
      /ERR_AUTOMATION/,
    )
    assert.throws(
      () =>
        verifyGeometryBehavior(
          Array.from({ length: 16 }, (_, i) => ({ x: i, y: 0, t: i * 30 })),
          strength,
          60,
          60,
        ),
      /ERR_AUTOMATION_DETECTED_LINEAR_TRAJECTORY/,
    )
  }
  assert.equal(GEOMETRY_BEHAVIOR_MIN_POINTS.strict, 12)
  assert.equal(GEOMETRY_BEHAVIOR_MIN_TIME_MS.strict, 300)
  assert.throws(() => verifyGeometryBehavior(samples(16, 5500), 'low', 5, 15), /ERR_AUTOMATION/)
  const badTime = samples()
  badTime[5].t = badTime[4].t
  assert.throws(() => verifyGeometryBehavior(badTime, 'low', 10, 15), /ERR_AUTOMATION/)
  const teleport = samples().map((p, i) => ({ ...p, x: p.x + (i >= 5 ? 1000 : 0), s: 0 }))
  assert.throws(() => verifyGeometryBehavior(teleport, 'strict', 10, 15), /ERR_AUTOMATION/)
  for (let i = 5; i < teleport.length; i++) teleport[i].s = 1
  assert.doesNotThrow(() => verifyGeometryBehavior(teleport, 'strict', 10, 15))
})

test('finite-but-overflowing statistics cannot bypass either algorithm', () => {
  const overflow = Array.from({ length: 16 }, (_, i) => ({ x: i * i, y: 1e308, t: i * 32 }))
  for (const strength of ['low', 'normal', 'strict']) {
    const slider = CaptchaChallenge.create({
      id: 'unit',
      targetPosition: 120,
      strength,
      verified: false,
      expiresAt: new Date(Date.now() + 10000),
    })
    assert.throws(
      () => slider.verifyTrajectoryForUnlock(overflow, 480, 120),
      /ERR_AUTOMATION_DETECTED_INVALID_PATH/,
    )
    assert.throws(
      () => verifyGeometryBehavior(overflow, strength, 10, 15),
      /ERR_AUTOMATION_DETECTED_INVALID_PATH/,
    )
  }
})

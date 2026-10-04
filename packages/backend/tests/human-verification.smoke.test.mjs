// Targeted smoke: compiled core + HTTP control + signed bundled plugin in a child process.
// DB/atomic storage are deterministic adapters here; this is NOT real Redis/Docker acceptance.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { randomBytes, generateKeyPairSync, sign, createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises'
import { fork } from 'node:child_process'
import { once } from 'node:events'
import path from 'node:path'
import os from 'node:os'
import { PluginControl, createControlServer } from '../../../scripts/plugin-control.mjs'
import { inspectArchive } from '../../../scripts/plugin-archive.mjs'
import { sha256, signingPayload } from '../../../scripts/plugin-v2.mjs'

const require = createRequire(import.meta.url)
const express = require('express')
const cookieParser = require('cookie-parser')
const {
  HumanVerificationService,
  defaultVerificationPolicy,
  parseVerificationPolicy,
} = require('../dist/application/system/HumanVerificationService')
process.env.NODE_ENV = 'test'
process.env.TEMP_TOKEN_SECRET = randomBytes(32).toString('hex')
process.env.REDIS_URL = 'redis://fixture.invalid:6379'
let row
const prisma = { plugin: { findUnique: async () => row } }
for (const [file, value] of [
  ['../dist/db', { prisma }],
  ['../dist/lib/redis', { redis: {} }],
  ['../dist/registry', { rateLimitProtectionService: {} }],
])
  require.cache[require.resolve(file)] = {
    id: require.resolve(file),
    filename: require.resolve(file),
    loaded: true,
    exports: value,
  }
const {
  HttpHumanVerificationRuntime,
} = require('../dist/infrastructure/plugins/HumanVerificationAdapter')
const { RedisVerificationStore } = require('../dist/infrastructure/plugins/RedisVerificationStore')
const { createHumanVerificationRouter } = require('../dist/routes/humanVerification')
const {
  humanVerificationContext,
  currentVerificationBinding,
} = require('../dist/middleware/humanVerificationContext')

class AtomicFixtureStore {
  records = new Map()
  fail = false
  async put(kind, token, record) {
    if (this.fail) throw Error('storage unavailable')
    const key = kind + ':' + token
    assert.equal(this.records.has(key), false)
    this.records.set(key, structuredClone(record))
  }
  async take(kind, token, expected, now) {
    if (this.fail) throw Error('storage unavailable')
    const key = kind + ':' + token
    const record = this.records.get(key)
    if (!record) return null
    if (record.deadline <= now) {
      this.records.delete(key)
      return null
    }
    if (!Object.entries(expected).every(([key, value]) => record[key] === value)) return null
    this.records.delete(key)
    return record
  }
}
function fixture() {
  let binding = 'client-one',
    epoch = 'v1',
    now = Date.now()
  const store = new AtomicFixtureStore()
  const snapshot = {
    providerId: 'human-verification',
    version: '1.0.0',
    generation: 'one',
    artifactSha256: 'a'.repeat(64),
    policy: defaultVerificationPolicy(),
  }
  const runtime = {
    providerId: snapshot.providerId,
    inspect: async () => structuredClone(snapshot),
    call: async (_snapshot, operation) =>
      operation === 'issue'
        ? { challengeId: 'private-worker-id', challenge: { kind: 'fixture' }, expiresInSec: 300 }
        : { verified: true, assurance: 'normal' },
  }
  return {
    store,
    snapshot,
    runtime,
    service: new HumanVerificationService(
      runtime,
      store,
      () => binding,
      () => epoch,
      () => now,
    ),
    setBinding: (v) => {
      binding = v
    },
    setEpoch: (v) => {
      epoch = v
    },
    advance: (v) => {
      now += v
    },
  }
}
test('one-shot challenge/proof; binding, purpose, epoch and lifecycle are enforced', async () => {
  const f = fixture()
  const issued = await f.service.issue('post')
  assert.notEqual(issued.challengeId, 'private-worker-id')
  f.setBinding('another-client')
  await assert.rejects(f.service.verify(issued.challengeId, {}), /INVALID/)
  f.setBinding('client-one')
  const results = await Promise.allSettled([
    f.service.verify(issued.challengeId, {}),
    f.service.verify(issued.challengeId, {}),
  ])
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  const proof = results.find((r) => r.status === 'fulfilled').value.verificationToken
  assert.equal(await f.service.consumeProof(proof, 'comment'), false)
  f.setBinding('another-client')
  assert.equal(await f.service.consumeProof(proof, 'post'), false)
  f.setBinding('client-one')
  assert.deepEqual(
    (
      await Promise.all([
        f.service.consumeProof(proof, 'post'),
        f.service.consumeProof(proof, 'post'),
      ])
    ).sort(),
    [false, true],
  )
  assert.equal(await f.service.consumeProof('legacy-database-id', 'post'), false)
  for (const change of [
    () => {
      f.snapshot.generation += '-new'
    },
    () => f.setEpoch('v2'),
    () => f.advance(300001),
  ]) {
    const issue = await f.service.issue('comment')
    change()
    await assert.rejects(f.service.verify(issue.challengeId, {}), /INVALID/)
  }
  const generation = await f.service.issue('comment')
  f.runtime.call = async () => {
    f.snapshot.generation += '-changed-during-verify'
    return { verified: true, assurance: 'strict' }
  }
  await assert.rejects(f.service.verify(generation.challengeId, {}), /INVALID/)
  assert.equal([...f.store.records.keys()].filter((key) => key.startsWith('proof:')).length, 0)
})
test('provider and storage failures fail closed; failed verification cannot restore a challenge', async () => {
  const f = fixture()
  const issue = await f.service.issue('registration')
  f.runtime.call = async () => {
    throw Error('runtime disconnected')
  }
  await assert.rejects(f.service.verify(issue.challengeId, {}), /disconnected/)
  await assert.rejects(f.service.verify(issue.challengeId, {}), /INVALID/)
  f.runtime.inspect = async () => {
    throw Error('unavailable')
  }
  assert.deepEqual(await f.service.requirements(), {
    ...defaultVerificationPolicy(),
    available: false,
    providerId: 'human-verification',
  })
  await assert.rejects(f.service.requires('registration'), /unavailable/)
  const unavailableStore = new RedisVerificationStore({ status: 'end' }, () => true)
  await assert.rejects(unavailableStore.take('proof', 'any', {}, Date.now()), /UNAVAILABLE/)
  const unconfigured = new RedisVerificationStore({}, () => false)
  await assert.rejects(unconfigured.put('proof', 'any', {}, 120), /UNAVAILABLE/)
  const f2 = fixture()
  const ready = await f2.service.issue('post')
  f2.runtime.call = async () => {
    f2.store.fail = true
    return { verified: true, assurance: 'normal' }
  }
  await assert.rejects(f2.service.verify(ready.challengeId, {}), /storage unavailable/)
  assert.equal([...f2.store.records.keys()].filter((key) => key.startsWith('proof:')).length, 0)
  assert.deepEqual(parseVerificationPolicy({ surfaces: { post: false } }), {
    enabled: true,
    surfaces: { registration: true, post: false, comment: true, friendRequest: true },
  })
  await assert.rejects(f2.service.verify('x'.repeat(43), JSON.parse('{"__proto__":{}}')), /INVALID/)
})

function tar(entries) {
  const blocks = []
  for (const [name, data] of entries) {
    const h = Buffer.alloc(512)
    h.write(name, 0, 100)
    h.write('0000644\0', 100)
    h.write('0000000\0', 108)
    h.write('0000000\0', 116)
    h.write(data.length.toString(8).padStart(11, '0') + '\0', 124)
    h.write('00000000000\0', 136)
    h.fill(32, 148, 156)
    h.write('0', 156)
    h.write('ustar\0', 257)
    h.write('00', 263)
    h.write(
      [...h]
        .reduce((a, b) => a + b, 0)
        .toString(8)
        .padStart(6, '0') + '\0 ',
      148,
    )
    blocks.push(h, data, Buffer.alloc((512 - (data.length % 512)) % 512))
  }
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]))
}
async function signedBundle() {
  const root = new URL('../plugins/human-verification/', import.meta.url)
  const entries = []
  async function walk(prefix = '') {
    for (const item of await readdir(new URL(prefix, root), { withFileTypes: true })) {
      const name = prefix + item.name
      if (item.isDirectory()) await walk(name + '/')
      else if (item.isFile()) entries.push([name, await readFile(new URL(name, root))])
      else throw Error('Unexpected nonregular bundled file')
    }
  }
  await walk()
  const manifest = JSON.parse(entries.find(([name]) => name === 'manifest.json')[1])
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const archive = tar(entries)
  const digest = sha256(archive)
  return {
    archive,
    digest,
    manifest,
    entries,
    signature: sign(null, signingPayload(digest, manifest), privateKey),
    trust: {
      keys: { [manifest.signatureKeyId]: publicKey.export({ type: 'spki', format: 'pem' }) },
    },
  }
}
async function listen(server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return 'http://127.0.0.1:' + server.address().port
}
function solvePow(challenge) {
  for (let nonce = 0; nonce < 1000000; nonce++) {
    const digest = createHash('sha256')
      .update(challenge.challengeHex + '|' + nonce)
      .digest()
    const bits = [...digest].map((v) => v.toString(2).padStart(8, '0')).join('')
    if (bits.startsWith('0'.repeat(challenge.bits))) return { nonce: String(nonce) }
  }
  throw Error('test PoW budget exceeded')
}

test(
  'signed provider process + supervisor + compiled core over HTTP, with privacy and fail-closed gates',
  { timeout: 30000 },
  async (t) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mynd-hv-smoke-'))
    const children = new Map(),
      servers = [],
      forwarded = []
    async function stop(name) {
      const item = children.get(name)
      if (!item) return
      if (item.child.exitCode === null) {
        const exited = once(item.child, 'exit')
        item.child.kill('SIGKILL')
        await exited
      }
      children.delete(name)
    }
    t.after(async () => {
      for (const server of servers) {
        server.closeAllConnections?.()
        await new Promise((resolve) => server.close(resolve))
      }
      for (const name of children.keys()) await stop(name)
      assert.ok(root.startsWith(path.join(os.tmpdir(), 'mynd-hv-smoke-')))
      await rm(root, { recursive: true, force: true })
    })
    const bundle = await signedBundle()
    assert.equal(inspectArchive(bundle.archive).artifactSha256, bundle.digest)
    assert.throws(
      () =>
        inspectArchive(
          tar(
            bundle.entries.filter(
              ([name]) => name !== bundle.manifest.capabilities.humanVerification.ui,
            ),
          ),
        ),
      /VERIFICATION_CAPABILITY/,
    )
    const trustFile = path.join(root, 'trust.json')
    await writeFile(trustFile, JSON.stringify(bundle.trust))
    const runtime = {
      async start(input) {
        const child = fork(
          new URL('../../../scripts/plugin-host.mjs', import.meta.url),
          [path.join(input.release, 'manifest.json'), '0'],
          {
            stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
            // No backend environment/database keys are inherited by the worker.
            env: {
              PATH: process.env.PATH,
              SystemRoot: process.env.SystemRoot,
              PLUGIN_TRUST_KEYS_FILE: trustFile,
              PLUGIN_ARTIFACT_SHA256: input.digest,
              PLUGIN_EVENT_TOKEN: input.eventToken,
              PLUGIN_PROXY_TOKEN: input.proxyToken,
              PLUGIN_CONFIG_JSON: JSON.stringify(input.config),
            },
          },
        )
        children.set(input.name, { child })
        const message = await Promise.race([
          once(child, 'message').then(([v]) => v),
          once(child, 'exit').then(([code]) => {
            throw Error('worker exit ' + code)
          }),
        ])
        children.get(input.name).url = 'http://127.0.0.1:' + message.port
      },
      stop,
      async health(name) {
        const response = await fetch(children.get(name).url + '/healthz', {
          signal: AbortSignal.timeout(2000),
        })
        const value = await response.json()
        return { healthy: response.ok && value.status === 'ok', version: value.version }
      },
      request(name, endpoint, options) {
        forwarded.push({ endpoint, headers: options.headers, body: JSON.parse(options.body) })
        return fetch(children.get(name).url + endpoint, options)
      },
    }
    const control = new PluginControl({
      root: path.join(root, 'plugins'),
      trustKeysFile: trustFile,
      runtimeSecret: randomBytes(32).toString('hex'),
      runtime,
      attempts: 2,
      interval: 1,
    })
    await control.stage(bundle.archive, bundle.signature)
    await assert.rejects(
      control.activate(bundle.manifest.id, bundle.manifest.version, {}),
      /ENOENT|NOT_APPROVED/,
    )
    await control.approve(bundle.manifest.id, bundle.manifest.version, bundle.digest)
    const config = {
      federal: {
        enabled: true,
        kinds: { slider: false, geometry: false, pow: true },
        defaultKind: 'pow',
        powBits: 8,
      },
    }
    await control.activate(bundle.manifest.id, bundle.manifest.version, config, bundle.digest)
    row = {
      desiredState: 'ACTIVE',
      runtimeState: 'ACTIVE',
      currentVersion: bundle.manifest.version,
      releases: [
        {
          version: bundle.manifest.version,
          state: 'ACTIVE',
          approvedAt: new Date(),
          artifactSha256: bundle.digest,
        },
      ],
      config: { publicConfig: { enabled: false } }, // unsaved-to-runtime draft must not bypass authorization
    }
    process.env.PLUGIN_CONTROL_TOKEN = randomBytes(32).toString('hex')
    const controlServer = createControlServer(control, process.env.PLUGIN_CONTROL_TOKEN)
    servers.push(controlServer)
    process.env.PLUGIN_CONTROL_URL = await listen(controlServer)
    const adapter = new HttpHumanVerificationRuntime()
    assert.equal((await adapter.inspect()).policy.enabled, true)
    row.runtimeState = 'ROLLED_BACK'
    assert.equal((await adapter.inspect()).policy.enabled, true)
    row.runtimeState = 'ACTIVE'
    const store = new AtomicFixtureStore()
    const service = new HumanVerificationService(adapter, store, currentVerificationBinding)
    let grants = 0,
      denyGrant = false
    const app = express()
    app.set('trust proxy', 1)
    app.use(express.json({ limit: '32kb' }), cookieParser(), humanVerificationContext)
    app.use(
      '/api/human-verification',
      createHumanVerificationRouter(service, {
        async grant() {
          if (denyGrant) throw Error('durable exemption write failed')
          grants++
          return {
            unlockToken: 'fixture-unlock',
            exemptMinutes: 15,
            expiresAt: new Date(Date.now() + 900000).toISOString(),
          }
        },
      }),
    )
    const apiServer = app.listen(0, '127.0.0.1')
    servers.push(apiServer)
    await once(apiServer, 'listening')
    const base = 'http://127.0.0.1:' + apiServer.address().port + '/api/human-verification'
    const requirements = await fetch(base + '/requirements')
    assert.equal((await requirements.json()).available, true)
    const cookie = requirements.headers.get('set-cookie').split(';')[0]
    assert.match(requirements.headers.get('set-cookie'), /HttpOnly/)
    assert.match(requirements.headers.get('set-cookie'), /SameSite=Strict/)
    let count = 0
    const post = async (endpoint, input, clientCookie = cookie, extra = {}) => {
      count++
      return fetch(base + endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: clientCookie,
          authorization: 'Bearer browser-must-not-cross',
          ...extra,
        },
        body: JSON.stringify(input),
      })
    }
    const ui = await fetch(base + '/ui', { headers: { cookie } })
    assert.equal(ui.status, 200)
    assert.equal(ui.headers.get('set-cookie'), null)
    assert.match(ui.headers.get('content-security-policy'), /sandbox allow-scripts/)
    assert.doesNotMatch(ui.headers.get('content-security-policy'), /allow-same-origin/)
    assert.equal(ui.headers.get('cache-control'), 'no-store')
    assert.match(await ui.text(), /myndbbs:verification:ready/)
    const challengeResponse = await post('/challenge', { purpose: 'rateLimitUnlock' })
    assert.equal(challengeResponse.status, 200)
    const challenge = await challengeResponse.json()
    assert.equal(challenge.challenge.kind, 'pow')
    const solution = solvePow(challenge.challenge)
    assert.equal(
      (await post('/verify', { challengeId: challenge.challengeId, solution, purpose: 'post' }))
        .status,
      400,
    )
    const responses = await Promise.all([
      post('/verify', { challengeId: challenge.challengeId, solution }),
      post('/verify', { challengeId: challenge.challengeId, solution }),
    ])
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 400])
    const proof = await responses.find((r) => r.status === 200).json()
    assert.equal(
      (
        await post(
          '/unlock',
          { verificationToken: proof.verificationToken },
          'mynd-hv=' + randomBytes(32).toString('base64url'),
        )
      ).status,
      400,
    )
    const unlocked = await post('/unlock', { verificationToken: proof.verificationToken })
    assert.equal(unlocked.status, 200)
    assert.equal((await unlocked.json()).exemptMinutes, 15)
    assert.equal(
      (await post('/unlock', { verificationToken: proof.verificationToken })).status,
      400,
    )
    assert.equal(grants, 1)
    const issue2 = await (await post('/challenge', { purpose: 'rateLimitUnlock' })).json()
    const proof2 = await (
      await post('/verify', {
        challengeId: issue2.challengeId,
        solution: solvePow(issue2.challenge),
      })
    ).json()
    denyGrant = true
    assert.equal(
      (await post('/unlock', { verificationToken: proof2.verificationToken })).status,
      503,
    )
    denyGrant = false
    assert.equal(
      (await post('/unlock', { verificationToken: proof2.verificationToken })).status,
      400,
    )
    assert.equal(grants, 1)
    for (const purpose of ['registration', 'post', 'comment', 'friendRequest']) {
      const response = await post('/challenge', { purpose })
      assert.equal(response.status, 200)
      assert.equal((await response.json()).challenge.kind, 'slider')
    }
    const beforeReload = await (await post('/challenge', { purpose: 'rateLimitUnlock' })).json()
    await control.reload(bundle.manifest.id, config)
    assert.equal(
      (
        await post('/verify', {
          challengeId: beforeReload.challengeId,
          solution: solvePow(beforeReload.challenge),
        })
      ).status,
      400,
    )
    const workerUrl = [...children.values()][0].url
    assert.equal(
      (await fetch(workerUrl + '/__human-verification', { method: 'POST', body: '{}' })).status,
      404,
    )
    assert.equal(
      (
        await fetch(
          process.env.PLUGIN_CONTROL_URL + '/v1/plugins/human-verification/human-verification',
        )
      ).status,
      404,
    )
    for (const item of forwarded) {
      assert.deepEqual(Object.keys(item.headers).sort(), ['content-type', 'x-plugin-proxy-token'])
      assert.deepEqual(
        Object.keys(item.body).sort(),
        item.body.operation === 'ui' ? ['input', 'operation'] : ['input', 'operation', 'purpose'],
      )
      assert.ok(!JSON.stringify(item).includes('browser-must-not-cross'))
      assert.ok(!JSON.stringify(item).includes(cookie))
    }
    await control.deactivate(bundle.manifest.id)
    const unavailable = await (await fetch(base + '/requirements')).json()
    assert.equal(unavailable.available, false)
    assert.equal(unavailable.enabled, true)
    assert.equal((await post('/challenge', { purpose: 'post' })).status, 503)
    // Rotating binding cookies and adding an attacker-controlled left XFF prefix cannot reset the trusted-IP budget.
    while (count < 30) await post('/verify', {}, 'mynd-hv=' + randomBytes(32).toString('base64url'))
    const limited = await post(
      '/challenge',
      { purpose: 'post' },
      'mynd-hv=' + randomBytes(32).toString('base64url'),
      { 'x-forwarded-for': '203.0.113.9, 127.0.0.1' },
    )
    assert.equal(limited.status, 429)
    assert.equal((await limited.json()).error, 'ERR_HUMAN_VERIFICATION_RATE_LIMITED')
  },
)

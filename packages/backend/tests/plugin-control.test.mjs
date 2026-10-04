import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fork } from 'node:child_process'
import { PluginControl, createControlServer } from '../../../scripts/plugin-control.mjs'
import { inspectArchive } from '../../../scripts/plugin-archive.mjs'
import { sha256, signingPayload } from '../../../scripts/plugin-v2.mjs'
const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const trust = { keys: { test: publicKey.export({ type: 'spki', format: 'pem' }) } }
const code =
  'export default { activate(ctx) { this.config=ctx.getConfig(); this.n=0 }, async handleEvent() { await new Promise(r=>setTimeout(r,5)); this.n++ }, handle() {return {body:{config:this.config,n:this.n}}} }'
function tar(entries) {
  const parts = []
  for (const [name, value, type = '0'] of entries) {
    const data = Buffer.from(value)
    const h = Buffer.alloc(512)
    h.write(name, 0, 100, 'utf8')
    h.write('0000644\0', 100)
    h.write('0000000\0', 108)
    h.write('0000000\0', 116)
    h.write(data.length.toString(8).padStart(11, '0') + '\0', 124)
    h.write('00000000000\0', 136)
    h.fill(32, 148, 156)
    h.write(type, 156)
    h.write('ustar\0', 257)
    h.write('00', 263)
    h.write(
      [...h]
        .reduce((a, b) => a + b, 0)
        .toString(8)
        .padStart(6, '0') + '\0 ',
      148,
    )
    parts.push(h, data, Buffer.alloc((512 - (data.length % 512)) % 512))
  }
  return gzipSync(Buffer.concat([...parts, Buffer.alloc(1024)]))
}
function artifact(version = '1.0.0', extra = []) {
  const manifest = {
    id: 'demo',
    version,
    apiVersion: 2,
    entry: 'index.mjs',
    entrySha256: sha256(code),
    signatureKeyId: 'test',
    capabilities: {
      routes: [{ path: '/echo', methods: ['GET'], auth: 'authenticated' }],
      events: [{ name: 'PostApprovedEvent', version: 1 }],
      ui: [{ slot: 'admin.detail', path: 'ui/index.html' }],
      config: {
        schema: { type: 'object', properties: { token: { type: 'string' } } },
        secretPaths: ['/token'],
      },
    },
  }
  const archive = tar([
    ['manifest.json', JSON.stringify(manifest)],
    ['index.mjs', code],
    ['ui/index.html', '<p>isolated</p>'],
    ...extra,
  ])
  const digest = sha256(archive)
  return {
    archive,
    signature: sign(null, signingPayload(digest, manifest), privateKey),
    digest,
    manifest,
  }
}
async function fixture(t, runtime) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'plugin-v2-'))
  const trustFile = path.join(root, 'trust.json')
  await writeFile(trustFile, JSON.stringify(trust))
  t.after(async () => {
    await rm(root, { recursive: true, force: true })
  })
  const instances = new Map()
  const stopped = []
  const fake = runtime || {
    start: async (input) => {
      instances.set(input.name, input)
    },
    health: async (name) => ({ healthy: true, version: instances.get(name)?.version }),
    stop: async (name) => {
      stopped.push(name)
      instances.delete(name)
    },
    request: async () => new Response('{}'),
  }
  return {
    root,
    trustFile,
    instances,
    stopped,
    runtime: fake,
    control: new PluginControl({
      root: path.join(root, 'plugins'),
      trustKeysFile: trustFile,
      runtimeSecret: 'r'.repeat(32),
      runtime: fake,
      attempts: 2,
      interval: 1,
    }),
  }
}
test('signed v2 quarantine -> approval -> activation -> failure keeps old -> rollback -> deactivate', async (t) => {
  const f = await fixture(t)
  const a = artifact()
  const b = artifact('2.0.0')
  await f.control.stage(a.archive, a.signature)
  await assert.rejects(f.control.activate('demo', '1.0.0', {}), /ENOENT|NOT_APPROVED/)
  await f.control.approve('demo', '1.0.0', a.digest)
  assert.equal(
    (await f.control.activate('demo', '1.0.0', { token: 'one' }, a.digest)).healthy,
    true,
  )
  const previous = await f.control.state('demo')
  await f.control.stage(b.archive, b.signature)
  await f.control.approve('demo', '2.0.0', b.digest)
  const health = f.runtime.health
  f.runtime.health = async () => ({ healthy: false })
  await assert.rejects(
    f.control.activate('demo', '2.0.0', { token: 'two' }, b.digest),
    /START_FAILED/,
  )
  assert.deepEqual(await f.control.state('demo'), previous)
  assert.ok(f.instances.has(previous.container))
  f.runtime.health = health
  assert.equal(
    (await f.control.activate('demo', '2.0.0', { token: 'two' }, b.digest)).version,
    '2.0.0',
  )
  assert.equal(f.instances.size, 1)
  await f.control.activate('demo', '1.0.0', { token: 'one' }, a.digest)
  const restored = await f.control.state('demo')
  assert.equal(restored.version, '1.0.0')
  const restarted = new PluginControl({
    root: f.control.root,
    trustKeysFile: f.trustFile,
    runtimeSecret: 'r'.repeat(32),
    runtime: f.runtime,
  })
  assert.equal((await restarted.health('demo')).healthy, true)
  await assert.rejects(restarted.remove('demo'), /MUST_BE_DISABLED/)
  await restarted.deactivate('demo')
  assert.equal((await restarted.health('demo')).state, 'DISABLED')
  await restarted.remove('demo')
})
test('invalid archive types/paths/duplicates and hash/signature fail before extraction', async (t) => {
  const f = await fixture(t)
  for (const name of ['../evil', '/absolute', 'C:/absolute', 'x/../../evil', 'a\\evil'])
    assert.throws(() => inspectArchive(tar([[name, 'x']])), /PATH_TRAVERSAL/)
  for (const type of ['1', '2', '3', '4', '6', 'x', 'g', 'L'])
    assert.throws(() => inspectArchive(tar([['evil', 'x', type]])), /SPECIAL_FILE/)
  assert.throws(
    () =>
      inspectArchive(
        tar([
          ['same', 'a'],
          ['same', 'b'],
        ]),
      ),
    /DUPLICATE_PATH/,
  )
  assert.throws(() => inspectArchive(tar([['big', Buffer.alloc(65 * 1024 * 1024)]])), /TOO_LARGE/)
  const a = artifact()
  await assert.rejects(f.control.stage(a.archive, Buffer.alloc(64)), /SIGNATURE_INVALID/)
  const v1 = { ...a.manifest, apiVersion: 1 }
  assert.throws(
    () =>
      inspectArchive(
        tar([
          ['manifest.json', JSON.stringify(v1)],
          ['index.mjs', code],
        ]),
      ),
    /INVALID_PLUGIN_MANIFEST/,
  )
  await f.control.stage(a.archive, a.signature)
  await f.control.approve('demo', '1.0.0', a.digest)
  await writeFile(
    path.join(f.control.root, 'demo', 'releases', '1.0.0', 'ui', 'index.html'),
    'tampered',
  )
  await assert.rejects(f.control.activate('demo', '1.0.0', {}, a.digest), /INTEGRITY_FAILED/)
})
test('real HTTP control auth and per-plugin proxy token separation', async (t) => {
  const f = await fixture(t)
  const server = createControlServer(f.control, 'c'.repeat(32))
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  t.after(
    () =>
      new Promise((r) => {
        server.closeAllConnections()
        server.close(r)
      }),
  )
  const url = 'http://127.0.0.1:' + server.address().port
  assert.equal((await fetch(url + '/v1/plugins/demo/health')).status, 404)
  const headers = { 'x-plugin-control-token': 'c'.repeat(32), 'content-type': 'application/json' }
  const a = artifact()
  const post = async (p, b) => fetch(url + p, { method: 'POST', headers, body: JSON.stringify(b) })
  assert.equal(
    (
      await post('/v1/plugins/stage', {
        archiveBase64: a.archive.toString('base64'),
        signatureBase64: a.signature.toString('base64'),
      })
    ).status,
    201,
  )
  assert.equal(
    (await post('/v1/plugins/demo/approve', { version: '1.0.0', artifactSha256: a.digest })).status,
    200,
  )
  assert.equal(
    (
      await post('/v1/plugins/demo/activate', {
        version: '1.0.0',
        artifactSha256: a.digest,
        config: { token: 'private' },
      })
    ).status,
    200,
  )
  assert.notEqual(f.control.token('demo', 'gen', 'event'), f.control.token('other', 'gen', 'event'))
  assert.equal(
    (
      await post('/v1/plugins/demo/proxy', {
        method: 'GET',
        path: '/__events',
        user: { id: 'u', role: 'SUPER_ADMIN' },
      })
    ).status,
    400,
  )
  const input = [...f.instances.values()][0]
  assert.equal(input.config.token, 'private')
  assert.ok(!JSON.stringify(input).includes('c'.repeat(32)))
})
test('actual isolated host receives config, strips credentials, and deduplicates events', async (t) => {
  const f = await fixture(t)
  const a = artifact()
  await f.control.stage(a.archive, a.signature)
  await f.control.approve('demo', '1.0.0', a.digest)
  const manifest = path.join(f.control.root, 'demo', 'releases', '1.0.0', 'manifest.json')
  const child = fork(
    new URL('../../../scripts/plugin-host.mjs', import.meta.url),
    [manifest, '0'],
    {
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
      env: {
        ...process.env,
        PLUGIN_TRUST_KEYS_FILE: f.trustFile,
        PLUGIN_ARTIFACT_SHA256: a.digest,
        PLUGIN_EVENT_TOKEN: 'e'.repeat(32),
        PLUGIN_PROXY_TOKEN: 'p'.repeat(32),
        PLUGIN_CONFIG_JSON: JSON.stringify({ token: 'runtime-only' }),
      },
    },
  )
  t.after(async () => {
    if (child.exitCode === null) {
      const stopped = new Promise((r) => child.once('exit', r))
      child.kill('SIGKILL')
      await stopped
    }
  })
  const ready = await new Promise((resolve, reject) => {
    child.once('message', resolve)
    child.once('exit', (c) => reject(new Error('host exited ' + c)))
  })
  const url = 'http://127.0.0.1:' + ready.port
  assert.equal((await fetch(url + '/echo')).status, 404)
  const event = {
    eventId: 'e1',
    eventName: 'PostApprovedEvent',
    schemaVersion: 1,
    idempotencyKey: 'key1',
    occurredAt: new Date().toISOString(),
    payload: { postId: 'p1' },
  }
  const post = () =>
    fetch(url + '/__events', {
      method: 'POST',
      headers: { 'x-plugin-event-token': 'e'.repeat(32), 'content-type': 'application/json' },
      body: JSON.stringify(event),
    })
  assert.deepEqual(
    (await Promise.all([post(), post()])).map((r) => r.status),
    [200, 200],
  )
  const response = await fetch(url + '/echo', {
    headers: {
      'x-plugin-proxy-token': 'p'.repeat(32),
      'x-mynd-role': 'ADMIN',
      'x-mynd-user-id': 'u',
    },
  })
  assert.deepEqual(await response.json(), { config: { token: 'runtime-only' }, n: 1 })
})

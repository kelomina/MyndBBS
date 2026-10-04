import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { fork } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function canonicalize(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`
}

async function createFixture(root) {
  const code = 'module.exports={activate(){}}'
  await writeFile(path.join(root, 'entry.cjs'), code)
  const manifest = {
    id: 'demo', version: '1.0.0', apiVersion: 2, entry: 'entry.cjs',
    entrySha256: createHash('sha256').update(code).digest('hex'), signatureKeyId: 'test-key',
    capabilities: { routes: [], events: [], ui: [] },
  }
  const archiveSha256 = createHash('sha256').update('test-archive').digest('hex')
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const payload = Buffer.from(`MYNDBBS_PLUGIN_V2\n${archiveSha256}\n${canonicalize(manifest)}\n`)
  await writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest))
  await writeFile(path.join(root, 'manifest.sig'), sign(null, payload, privateKey))
  const trust = path.join(root, 'trust.json')
  await writeFile(trust, JSON.stringify({ keys: { 'test-key': publicKey.export({ type: 'spki', format: 'pem' }) } }))
  return { manifest: path.join(root, 'manifest.json'), trust, archiveSha256 }
}

test('plugin host starts in a separate process with a verified v2 release', { timeout: 10000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mynd-host-'))
  const fixture = await createFixture(root)
  const previousTrust = process.env.PLUGIN_TRUST_KEYS_FILE
  const previousHash = process.env.PLUGIN_ARTIFACT_SHA256
  process.env.PLUGIN_TRUST_KEYS_FILE = fixture.trust
  process.env.PLUGIN_ARTIFACT_SHA256 = fixture.archiveSha256
  const child = fork(fileURLToPath(new URL('../../../scripts/plugin-host.mjs', import.meta.url)), [fixture.manifest, '0'], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] })
  try {
    const ready = await new Promise((resolve, reject) => {
      child.once('message', resolve)
      child.once('error', reject)
      child.once('exit', code => reject(new Error(`host exited ${code}`)))
    })
    assert.equal(ready.type, 'ready')
    assert.notEqual(child.pid, process.pid)
  } finally {
    const stopped = new Promise(resolve => child.once('exit', resolve))
    child.kill('SIGKILL')
    await stopped
    if (previousTrust === undefined) delete process.env.PLUGIN_TRUST_KEYS_FILE; else process.env.PLUGIN_TRUST_KEYS_FILE = previousTrust
    if (previousHash === undefined) delete process.env.PLUGIN_ARTIFACT_SHA256; else process.env.PLUGIN_ARTIFACT_SHA256 = previousHash
    await rm(root, { recursive: true, force: true })
  }
})

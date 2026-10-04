import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { PluginSupervisor } from '../../../scripts/plugin-supervisor.mjs'

function canonicalize(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`
}

test('supervisor replaces a v2 plugin only after the new host is ready', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mynd-supervisor-'))
  const entry = path.join(root, 'entry.cjs')
  const code = 'module.exports={activate(){}}'
  await writeFile(entry, code)
  const manifestValue = {
    id: 'demo', version: '1.0.0', apiVersion: 2, entry: 'entry.cjs',
    entrySha256: createHash('sha256').update(code).digest('hex'), signatureKeyId: 'test-key',
    capabilities: { routes: [], events: [], ui: [] },
  }
  const archiveSha256 = createHash('sha256').update('test-archive').digest('hex')
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const payload = Buffer.from(`MYNDBBS_PLUGIN_V2\n${archiveSha256}\n${canonicalize(manifestValue)}\n`)
  const manifest = path.join(root, 'manifest.json')
  await writeFile(manifest, JSON.stringify(manifestValue))
  await writeFile(path.join(root, 'manifest.sig'), sign(null, payload, privateKey))
  const trust = path.join(root, 'trust.json')
  await writeFile(trust, JSON.stringify({ keys: { 'test-key': publicKey.export({ type: 'spki', format: 'pem' }) } }))
  const oldTrust = process.env.PLUGIN_TRUST_KEYS_FILE
  const oldHash = process.env.PLUGIN_ARTIFACT_SHA256
  process.env.PLUGIN_TRUST_KEYS_FILE = trust
  process.env.PLUGIN_ARTIFACT_SHA256 = archiveSha256
  const supervisor = new PluginSupervisor()
  try {
    const first = await supervisor.reload(manifest, 0)
    const second = await supervisor.reload(manifest, 0)
    assert.notEqual(first, second)
  } finally {
    await supervisor.stop(manifest)
    if (oldTrust === undefined) delete process.env.PLUGIN_TRUST_KEYS_FILE; else process.env.PLUGIN_TRUST_KEYS_FILE = oldTrust
    if (oldHash === undefined) delete process.env.PLUGIN_ARTIFACT_SHA256; else process.env.PLUGIN_ARTIFACT_SHA256 = oldHash
    await rm(root, { recursive: true, force: true })
  }
})

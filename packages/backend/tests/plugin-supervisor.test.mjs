import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { PluginSupervisor } from '../../../scripts/plugin-supervisor.mjs'

test('supervisor replaces a plugin only after the new host is ready', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mynd-supervisor-'))
  const entry = path.join(root, 'entry.cjs'); const code = 'module.exports={activate(){}}'; await writeFile(entry, code)
  const manifest = path.join(root, 'manifest.json'); await writeFile(manifest, JSON.stringify({ id: 'demo', version: '1.0.0', apiVersion: 1, entry: 'entry.cjs', sha256: createHash('sha256').update(code).digest('hex') }))
  const supervisor = new PluginSupervisor()
  try { const first = await supervisor.reload(manifest, 0); const second = await supervisor.reload(manifest, 0); assert.notEqual(first, second) } finally { await supervisor.stop(manifest); await rm(root, { recursive: true, force: true }) }
})

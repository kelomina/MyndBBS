import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { switchRelease, rollback } from '../../../scripts/release-controller.mjs'

test('release switch is health-gated and rollback restores previous target', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mynd-release-'))
  try {
    await mkdir(path.join(root, 'releases', 'v1'), { recursive: true }); await mkdir(path.join(root, 'releases', 'v2'), { recursive: true })
    await writeFile(path.join(root, 'releases', 'v1', 'manifest.json'), JSON.stringify({ version: 'v1' }))
    await writeFile(path.join(root, 'releases', 'v2', 'manifest.json'), JSON.stringify({ version: 'v2' }))
    await writeFile(path.join(root, 'current'), path.join(root, 'releases', 'v1'))
    await assert.rejects(switchRelease({ root, version: 'v2', healthCheck: async () => { throw new Error('bad') } }), /bad/)
    assert.equal((await readFile(path.join(root, 'current'), 'utf8')).trim(), path.join(root, 'releases', 'v1'))
    await switchRelease({ root, version: 'v2', healthCheck: async () => {} })
    assert.equal((await readFile(path.join(root, 'current'), 'utf8')).trim(), path.join(root, 'releases', 'v2'))
    assert.equal(await rollback(root), path.join(root, 'releases', 'v1'))
  } finally { await rm(root, { recursive: true, force: true }) }
})

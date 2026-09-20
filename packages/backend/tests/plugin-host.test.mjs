import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { fork } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

test('plugin host starts in a separate process', { timeout: 10000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mynd-host-'))
  const code = 'module.exports={activate(){}}'
  await writeFile(path.join(root, 'entry.cjs'), code)
  const manifest = path.join(root, 'manifest.json')
  await writeFile(manifest, JSON.stringify({ id: 'demo', version: '1.0.0', apiVersion: 1, entry: 'entry.cjs', sha256: createHash('sha256').update(code).digest('hex') }))
  const child = fork(fileURLToPath(new URL('../../../scripts/plugin-host.mjs', import.meta.url)), [manifest, '0'], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] })
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
    await rm(root, { recursive: true, force: true })
  }
})

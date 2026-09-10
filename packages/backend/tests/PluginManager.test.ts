import { createHash } from 'crypto'
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises'
import os from 'os'
import path from 'path'
import { PluginManager } from '../src/infrastructure/plugins/PluginManager'

describe('PluginManager', () => {
  let root: string
  beforeEach(async () => { root = await mkdtemp(path.join(os.tmpdir(), 'mynd-plugin-')); await mkdir(path.join(root, 'demo')) })
  afterEach(async () => { await rm(root, { recursive: true, force: true }) })

  test('rejects plugins outside root and non-allowlisted plugins', async () => {
    const outside = path.join(root, '..', 'outside.json')
    await writeFile(outside, '{}')
    const manager = new PluginManager(root, new Set())
    await expect(manager.activate(outside)).rejects.toThrow('ERR_PLUGIN_PATH_TRAVERSAL')
  })

  test('verifies allowlist and entry integrity', async () => {
    const entry = path.join(root, 'demo', 'index.cjs')
    await writeFile(entry, 'module.exports = { activate() {} }')
    const digest = createHash('sha256').update(await import('fs/promises').then((fs) => fs.readFile(entry))).digest('hex')
    await writeFile(path.join(root, 'demo', 'manifest.json'), JSON.stringify({ id: 'demo', version: '1.0.0', apiVersion: 1, entry: 'index.cjs', sha256: digest }))
    const manager = new PluginManager(root, new Set(['demo']))
    await expect(manager.activate(path.join(root, 'demo', 'manifest.json'))).resolves.toBeUndefined()
  })
})

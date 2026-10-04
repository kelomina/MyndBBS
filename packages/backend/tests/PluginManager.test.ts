import { createHash } from 'crypto'
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'fs/promises'
import os from 'os'
import path from 'path'
import { PluginManager } from '../src/infrastructure/plugins/PluginManager'

const capabilities = { routes: [], events: [], ui: [] }

describe('PluginManager', () => {
  let root: string
  beforeEach(async () => { root = await mkdtemp(path.join(os.tmpdir(), 'mynd-plugin-')); await mkdir(path.join(root, 'demo')) })
  afterEach(async () => { await rm(root, { recursive: true, force: true }) })

  test('rejects plugins outside root and in-process activation', async () => {
    const outside = path.join(root, '..', `outside-${process.pid}.json`)
    await writeFile(outside, '{}')
    const manager = new PluginManager(root, new Set())
    await expect(manager.inspect(outside)).rejects.toThrow('ERR_PLUGIN_PATH_TRAVERSAL')
    await expect(manager.activate(outside)).rejects.toThrow('ERR_PLUGIN_IN_PROCESS_DISABLED')
    await rm(outside, { force: true })
  })

  test('verifies allowlist and entry integrity without importing plugin code', async () => {
    const entry = path.join(root, 'demo', 'index.mjs')
    await writeFile(entry, 'export default { activate() {} }')
    const digest = createHash('sha256').update(await import('fs/promises').then((fs) => fs.readFile(entry))).digest('hex')
    await writeFile(path.join(root, 'demo', 'manifest.json'), JSON.stringify({
      id: 'demo', version: '1.0.0', apiVersion: 2, entry: 'index.mjs', entrySha256: digest, signatureKeyId: 'test-key', capabilities,
    }))
    const manager = new PluginManager(root, new Set(['demo']))
    await expect(manager.inspect(path.join(root, 'demo', 'manifest.json'))).resolves.toEqual({ manifest: expect.objectContaining({ id: 'demo', apiVersion: 2 }), entryPath: await realpath(entry) })
  })
})

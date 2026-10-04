import path from 'node:path'
import { loadPlugin, createPluginServer } from './plugin-runtime.mjs'

// Local tooling host. Production is launched only by plugin-control in an isolated container.
const [manifestPath, portText] = process.argv.slice(2)
if (!manifestPath || !portText) throw new Error('usage: plugin-host.mjs <manifest.json> <port>')
const active = await loadPlugin(path.resolve(manifestPath))
const server = createPluginServer(active)
server.listen(Number(portText), '127.0.0.1', () =>
  process.send?.({
    type: 'ready',
    id: active.manifest.id,
    version: active.manifest.version,
    port: server.address()?.port,
  }),
)
process.on('SIGTERM', async () => {
  await active.plugin.deactivate?.()
  server.close(() => process.exit(0))
})

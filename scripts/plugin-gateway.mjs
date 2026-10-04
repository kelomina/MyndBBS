import path from 'node:path'
import { loadPlugin, createPluginServer } from './plugin-runtime.mjs'

// A container hosts one immutable approved release. Reload always replaces the
// container through plugin-control; there is no in-process hot-load/admin endpoint.
const active = await loadPlugin(
  path.join(path.resolve(process.env.PLUGIN_ROOT || '/plugins'), 'current', 'manifest.json'),
)
const server = createPluginServer(active)
server.listen(Number(process.env.PORT || 3500), '0.0.0.0')
process.on('SIGTERM', async () => {
  await active.plugin.deactivate?.()
  server.close(() => process.exit(0))
})

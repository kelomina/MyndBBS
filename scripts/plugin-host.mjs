import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const [manifestPath, portText] = process.argv.slice(2)
if (!manifestPath || !portText) throw new Error('usage: plugin-host.mjs <manifest.json> <port>')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const entry = path.resolve(path.dirname(manifestPath), manifest.entry)
const digest = createHash('sha256').update(await readFile(entry)).digest('hex')
if (digest !== manifest.sha256) throw new Error('ERR_PLUGIN_INTEGRITY_FAILED')
const mod = await import(pathToFileURL(entry).href)
const plugin = mod.default ?? mod
if (!plugin || typeof plugin.activate !== 'function') throw new Error('ERR_PLUGIN_ENTRY_INVALID')
let healthy = true
await plugin.activate({ pluginId: manifest.id, registerHealthCheck: async (check) => { healthy = false; await check(); healthy = true } })
const server = http.createServer((req, res) => {
  if (req.url === '/healthz') { res.writeHead(healthy ? 200 : 503, { 'content-type': 'application/json' }); res.end(JSON.stringify({ status: healthy ? 'ok' : 'unhealthy', plugin: manifest.id, version: manifest.version })); return }
  res.writeHead(404); res.end()
})
server.listen(Number(portText), '127.0.0.1', () => process.send?.({ type: 'ready', id: manifest.id, version: manifest.version }))
process.on('SIGTERM', async () => { await plugin.deactivate?.(); server.close(() => process.exit(0)) })

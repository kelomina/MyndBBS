import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const ID = /^[a-z0-9][a-z0-9-]{1,62}$/
const VERSION = /^\d+\.\d+\.\d+([+-][0-9A-Za-z.-]+)?$/
const MAX_BODY_BYTES = 1024 * 1024

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || !ID.test(manifest.id || '') || !VERSION.test(manifest.version || '') || manifest.apiVersion !== 1 || !/^[a-f0-9]{64}$/.test(manifest.sha256 || '')) {
    throw new Error('ERR_INVALID_PLUGIN_MANIFEST')
  }
  if (typeof manifest.entry !== 'string' || !manifest.entry || path.posix.isAbsolute(manifest.entry) || path.win32.isAbsolute(manifest.entry) || manifest.entry.includes('\\') || manifest.entry.includes(':') || manifest.entry.includes('\0') || manifest.entry.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('ERR_INVALID_PLUGIN_ENTRY')
  }
}

async function loadPlugin(manifestPath) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  validateManifest(manifest)
  const pluginDir = path.dirname(manifestPath)
  const entry = path.resolve(pluginDir, manifest.entry)
  if (!entry.startsWith(`${pluginDir}${path.sep}`)) throw new Error('ERR_PLUGIN_PATH_TRAVERSAL')
  const digest = createHash('sha256').update(await readFile(entry)).digest('hex')
  if (digest !== manifest.sha256) throw new Error('ERR_PLUGIN_INTEGRITY_FAILED')
  const mod = await import(`${pathToFileURL(entry).href}?v=${manifest.version}-${digest}`)
  const plugin = mod.default ?? mod
  if (!plugin || typeof plugin.activate !== 'function') throw new Error('ERR_PLUGIN_ENTRY_INVALID')
  let healthCheck = async () => undefined
  await plugin.activate({ pluginId: manifest.id, registerHealthCheck: (check) => { healthCheck = check } })
  return { manifest, plugin, healthCheck }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) reject(new Error('ERR_PLUGIN_REQUEST_TOO_LARGE'))
      else chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve(undefined)
      try { resolve(JSON.parse(raw)) } catch { resolve(raw) }
    })
    req.on('error', reject)
  })
}

const [manifestPath, portText] = process.argv.slice(2)
if (!manifestPath || !portText) throw new Error('usage: plugin-host.mjs <manifest.json> <port>')
const active = await loadPlugin(path.resolve(manifestPath))
let healthy = true
const server = http.createServer(async (req, res) => {
  if (req.url === '/healthz') {
    try { await active.healthCheck(); healthy = true } catch { healthy = false }
    res.writeHead(healthy ? 200 : 503, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ status: healthy ? 'ok' : 'unhealthy', plugin: active.manifest.id, version: active.manifest.version }))
    return
  }
  if (typeof active.plugin.handle !== 'function') { res.writeHead(404); res.end(); return }
  try {
    const result = await active.plugin.handle({ method: req.method || 'GET', path: req.url || '/', headers: req.headers, body: await readBody(req) })
    const status = Number.isInteger(result?.status) ? result.status : 200
    for (const [key, value] of Object.entries(result?.headers || {})) res.setHeader(key, value)
    res.writeHead(status)
    res.end(typeof result?.body === 'string' ? result.body : JSON.stringify(result?.body ?? null))
  } catch (error) {
    const code = error instanceof Error && error.message.startsWith('ERR_') ? error.message : 'ERR_PLUGIN_HANDLER_FAILED'
    res.writeHead(code === 'ERR_PLUGIN_REQUEST_TOO_LARGE' ? 413 : 500, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: code }))
  }
})
server.listen(Number(portText), '127.0.0.1', () => process.send?.({ type: 'ready', id: active.manifest.id, version: active.manifest.version, port: server.address()?.port }))
process.on('SIGTERM', async () => { await active.plugin.deactivate?.(); server.close(() => process.exit(0)) })

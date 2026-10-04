import http from 'node:http'
import { readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  validateManifest,
  verifySignature,
  sha256,
  tokenMatches,
  safeRequestPath,
  routeMatches,
  authAllowed,
  isObject,
} from './plugin-v2.mjs'

const MAX_BODY = 1024 * 1024
export function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(JSON.stringify(body))
}
export async function readJsonBody(req, limit = MAX_BODY) {
  const chunks = []
  let bytes = 0
  for await (const chunk of req) {
    bytes += chunk.length
    if (bytes > limit) throw new Error('ERR_PLUGIN_REQUEST_TOO_LARGE')
    chunks.push(chunk)
  }
  const body = Buffer.concat(chunks).toString('utf8')
  try {
    return body ? JSON.parse(body) : undefined
  } catch {
    throw new Error('ERR_INVALID_JSON')
  }
}
export async function loadPlugin(manifestPath) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  validateManifest(manifest)
  const directory = await realpath(path.dirname(manifestPath))
  const entry = await realpath(path.resolve(directory, manifest.entry))
  if (
    !entry.startsWith(directory + path.sep) ||
    sha256(await readFile(entry)) !== manifest.entrySha256
  )
    throw new Error('ERR_PLUGIN_INTEGRITY_FAILED')
  const trust = JSON.parse(await readFile(process.env.PLUGIN_TRUST_KEYS_FILE || '', 'utf8'))
  const signature = await readFile(path.join(directory, 'manifest.sig'))
  if (
    !verifySignature(
      signature,
      trust?.keys?.[manifest.signatureKeyId],
      process.env.PLUGIN_ARTIFACT_SHA256 || '',
      manifest,
    )
  )
    throw new Error('ERR_PLUGIN_SIGNATURE_INVALID')
  const mod = await import(pathToFileURL(entry).href)
  const plugin = mod.default ?? mod
  if (!plugin || typeof plugin.activate !== 'function') throw new Error('ERR_PLUGIN_ENTRY_INVALID')
  if (manifest.capabilities.routes.length && typeof plugin.handle !== 'function' || manifest.capabilities.events.length && typeof plugin.handleEvent !== 'function') throw new Error('ERR_PLUGIN_HANDLER_MISSING')
  const config = JSON.parse(process.env.PLUGIN_CONFIG_JSON || '{}')
  let healthCheck = async () => undefined
  await plugin.activate({
    pluginId: manifest.id,
    config: structuredClone(config),
    getConfig: () => structuredClone(config),
    registerHealthCheck: (fn) => {
      if (typeof fn !== 'function') throw new Error('ERR_PLUGIN_HEALTH_CHECK_INVALID')
      healthCheck = fn
    },
  })
  await healthCheck()
  return { manifest, directory, plugin, healthCheck }
}
export function createPluginServer(active) {
  const delivered = new Map()
  const pending = new Map()
  return http.createServer(async (req, res) => {
    try {
      if (req.url === '/healthz' && req.method === 'GET') {
        try {
          await active.healthCheck()
          json(res, 200, {
            status: 'ok',
            plugin: active.manifest.id,
            version: active.manifest.version,
          })
        } catch {
          json(res, 503, { status: 'unhealthy' })
        }
        return
      }
      if (req.url === '/__events') {
        if (
          req.method !== 'POST' ||
          !tokenMatches(req.headers['x-plugin-event-token'], process.env.PLUGIN_EVENT_TOKEN) ||
          typeof active.plugin.handleEvent !== 'function'
        ) {
          json(res, 404, { error: 'ERR_NOT_FOUND' })
          return
        }
        const event = await readJsonBody(req)
        if (
          !isObject(event) ||
          typeof event.eventId !== 'string' ||
          event.eventId.length > 200 ||
          !event.eventId ||
          typeof event.idempotencyKey !== 'string' ||
          !event.idempotencyKey ||
          event.idempotencyKey.length > 256 ||
          !isObject(event.payload) ||
          !Number.isFinite(Date.parse(event.occurredAt)) ||
          !active.manifest.capabilities.events.some(
            (e) => e.name === event.eventName && e.version === event.schemaVersion,
          )
        )
          throw new Error('ERR_INVALID_PLUGIN_EVENT')
        // Concurrent retries share a promise; failed handlers remain retryable.
        // This bounded cache is only an optimization. Plugins must persist their own
        // eventId/idempotencyKey deduplication alongside their business transaction.
        const key = event.eventId + ':' + event.idempotencyKey
        if (!delivered.has(key)) {
          if (!pending.has(key))
            pending.set(
              key,
              Promise.resolve()
                .then(() => active.plugin.handleEvent(event))
                .then(() => {
                  delivered.set(key, true)
                  if (delivered.size > 10000) delivered.delete(delivered.keys().next().value)
                })
                .finally(() => pending.delete(key)),
            )
          await pending.get(key)
        }
        json(res, 200, { status: 'ok' })
        return
      }
      if (!tokenMatches(req.headers['x-plugin-proxy-token'], process.env.PLUGIN_PROXY_TOKEN)) {
        json(res, 404, { error: 'ERR_NOT_FOUND' })
        return
      }
      if (!safeRequestPath(req.url || '/')) throw new Error('ERR_INVALID_PLUGIN_PATH')
      const pathname = (req.url || '/').split('?')[0]
      if (pathname.startsWith('/__ui/')) {
        const file = pathname.slice(6)
        if (
          !['GET', 'HEAD'].includes(req.method) ||
          !authAllowed(req.headers['x-mynd-role'], 'admin') ||
          !active.manifest.capabilities.ui.some((u) => u.path === file)
        ) {
          json(res, 404, { error: 'ERR_NOT_FOUND' })
          return
        }
        const content = await readFile(path.join(active.directory, file))
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        res.end(req.method === 'HEAD' ? undefined : content)
        return
      }
      const route = active.manifest.capabilities.routes.find(
        (r) => r.methods.includes(req.method) && routeMatches(r.path, pathname),
      )
      if (
        !route ||
        !authAllowed(req.headers['x-mynd-role'], route.auth) ||
        !req.headers['x-mynd-user-id'] ||
        typeof active.plugin.handle !== 'function'
      ) {
        json(res, 404, { error: 'ERR_NOT_FOUND' })
        return
      }
      const headers = Object.fromEntries(
        Object.entries(req.headers).filter(([k]) =>
          [
            'accept',
            'content-type',
            'x-mynd-user-id',
            'x-mynd-role',
            'x-mynd-authenticated',
            'x-mynd-auth-context-version',
          ].includes(k),
        ),
      )
      const result = await active.plugin.handle({
        method: req.method,
        path: req.url,
        headers,
        body: await readJsonBody(req),
      })
      const status =
        Number.isInteger(result?.status) && result.status >= 200 && result.status <= 599
          ? result.status
          : 200
      const body =
        typeof result?.body === 'string' ? result.body : JSON.stringify(result?.body ?? null)
      if (Buffer.byteLength(body) > MAX_BODY) throw new Error('ERR_PLUGIN_RESPONSE_TOO_LARGE')
      // Business APIs cannot serve same-origin executable HTML or set cookies.
      res.writeHead(status, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      })
      res.end(body)
    } catch (error) {
      const code =
        error instanceof Error && /^ERR_[A-Z_]+$/.test(error.message)
          ? error.message
          : 'ERR_PLUGIN_HANDLER_FAILED'
      json(res, code.includes('TOO_LARGE') ? 413 : code.includes('INVALID') ? 400 : 500, {
        error: code,
      })
    }
  })
}

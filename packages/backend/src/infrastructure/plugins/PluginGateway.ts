import type { Response } from 'express'
import type { AuthRequest } from '../../middleware/auth'
import type { BackendPluginManifest } from './PluginContracts'
import {
  validatePluginManifest,
  safeRequestPath,
  routeMatches,
  authAllowed,
} from './PluginManifest'

const ID = /^[a-z0-9][a-z0-9-]{1,62}$/
const UI_CSP =
  "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"
// No allowlist fallback or direct Docker DNS path: the supervisor's durable,
// approved ACTIVE pointer is the sole routing source in every environment.
async function control<T>(pathname: string, body?: unknown): Promise<T> {
  const target = process.env.PLUGIN_CONTROL_URL
  const token = process.env.PLUGIN_CONTROL_TOKEN
  if (!target || !token || token.length < 32) throw new Error('ERR_PLUGIN_CONTROL_UNAVAILABLE')
  const response = await fetch(target.replace(/\/$/, '') + pathname, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-plugin-control-token': token, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  })
  const result = (await response.json()) as T & { error?: string }
  if (!response.ok)
    throw new Error(typeof result.error === 'string' ? result.error : 'ERR_PLUGIN_CONTROL_FAILED')
  return result
}
export async function proxyPluginRequest(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.pluginId
  if (typeof id !== 'string' || !ID.test(id)) {
    res.status(404).json({ error: 'ERR_NOT_FOUND' })
    return
  }
  if (!req.user) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' })
    return
  }
  const suffix = req.path || '/'
  if (!safeRequestPath(suffix)) {
    res.status(400).json({ error: 'ERR_INVALID_PLUGIN_PATH' })
    return
  }
  try {
    const manifest = await control<BackendPluginManifest>('/v1/plugins/' + id + '/manifest')
    validatePluginManifest(manifest)
    if (manifest.id !== id) throw new Error('ERR_PLUGIN_NOT_ACTIVE')
    const ui =
      suffix.startsWith('/__ui/') &&
      ['GET', 'HEAD'].includes(req.method) &&
      manifest.capabilities.ui.some((m) => m.path === suffix.slice(6))
    const route = manifest.capabilities.routes.find(
      (r) => r.methods.includes(req.method) && routeMatches(r.path, suffix),
    )
    if ((suffix.startsWith('/__') && !ui) || (!ui && !route)) {
      res.status(404).json({ error: 'ERR_PLUGIN_ROUTE_NOT_DECLARED' })
      return
    }
    if (!authAllowed(req.user.role, ui ? 'admin' : (route?.auth ?? 'authenticated'))) {
      res.status(ui ? 404 : 403).json({ error: ui ? 'ERR_NOT_FOUND' : 'ERR_FORBIDDEN' })
      return
    }
    const raw = req.originalUrl || req.url || ''
    const query = raw.includes('?') ? raw.slice(raw.indexOf('?')) : ''
    const input = {
      method: req.method,
      path: suffix + query,
      user: { id: req.user.userId, role: req.user.role },
      ...(['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? {} : { body: req.body }),
    }
    if (Buffer.byteLength(JSON.stringify(input)) > 1024 * 1024) {
      res.status(413).json({ error: 'ERR_PLUGIN_REQUEST_TOO_LARGE' })
      return
    }
    const result = await control<{ status: number; bodyBase64: string }>(
      '/v1/plugins/' + id + '/proxy',
      input,
    )
    if (
      !Number.isInteger(result.status) ||
      result.status < 200 ||
      result.status > 599 ||
      typeof result.bodyBase64 !== 'string' ||
      result.bodyBase64.length > 1500000
    )
      throw new Error('ERR_PLUGIN_RESPONSE_INVALID')
    res.status(result.status)
    res.setHeader('content-type', ui ? 'text/html; charset=utf-8' : 'application/json')
    res.setHeader('x-content-type-options', 'nosniff')
    res.setHeader('cache-control', 'no-store')
    if (ui) res.setHeader('content-security-policy', UI_CSP)
    res.send(Buffer.from(result.bodyBase64, 'base64'))
  } catch (error) {
    const timeout = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
    const code = timeout
      ? 'ERR_PLUGIN_HOST_TIMEOUT'
      : error instanceof Error && /^ERR_[A-Z_]+$/.test(error.message)
        ? error.message
        : 'ERR_PLUGIN_HOST_UNAVAILABLE'
    res
      .status(code.includes('NOT_ACTIVE') ? 404 : code.includes('TOO_LARGE') ? 413 : 502)
      .json({ error: code })
  }
}

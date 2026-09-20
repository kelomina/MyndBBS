import { readFileSync } from 'node:fs'
import type { Request, Response } from 'express'
import type { AuthRequest } from '../../middleware/auth'

const PLUGIN_ID = /^[a-z0-9][a-z0-9-]{1,62}$/
const MAX_BODY_BYTES = 1024 * 1024
const TIMEOUT_MS = 5000

type GatewayMap = Readonly<Record<string, string>>

function expectedGatewayTarget(pluginId: string): string {
  return `http://myndbbs-plugin-${pluginId}:3500`
}

function isInternalTarget(url: string, pluginId: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' || !['', '/'].includes(parsed.pathname) || parsed.search || parsed.hash || parsed.username || parsed.password) return false
    if (parsed.port !== '3500') return false
    return parsed.hostname === `myndbbs-plugin-${pluginId}`
  } catch {
    return false
  }
}

function readGatewayMap(): GatewayMap {
  const raw = process.env.PLUGIN_GATEWAY_MAP
  if (!raw) return {}
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([id, url]) => PLUGIN_ID.test(id) && typeof url === 'string'))
  } catch {
    return {}
  }
}

function resolveGatewayTarget(pluginId: string): string | undefined {
  const expected = expectedGatewayTarget(pluginId)
  const mapped = readGatewayMap()[pluginId]
  if (mapped === undefined) return expected
  return isInternalTarget(mapped, pluginId) ? expected : undefined
}

function isAllowListed(pluginId: string): boolean {
  const file = process.env.PLUGIN_ALLOWLIST_FILE
  if (file) {
    try {
      const value: unknown = JSON.parse(readFileSync(file, 'utf8'))
      if (value && typeof value === 'object' && Array.isArray((value as { plugins?: unknown }).plugins)) return (value as { plugins: unknown[] }).plugins.includes(pluginId)
    } catch {
      return false
    }
  }
  return (process.env.PLUGIN_ALLOWLIST || '').split(',').map((id) => id.trim()).includes(pluginId)
}

function bodyForRequest(req: Request): string | undefined {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return undefined
  if (req.body === undefined) return undefined
  const body = JSON.stringify(req.body)
  if (body === undefined) return undefined
  if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) throw new Error('ERR_PLUGIN_REQUEST_TOO_LARGE')
  return body
}

async function checkPluginHealth(target: string): Promise<'healthy' | 'unhealthy'> {
  const health = await fetch(`${target.replace(/\/$/, '')}/healthz`, {
    method: 'GET',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  return health.ok ? 'healthy' : 'unhealthy'
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === 'TimeoutError' || error.name === 'AbortError' || /timeout|timed out/i.test(error.message)
}

export async function proxyPluginRequest(req: AuthRequest, res: Response): Promise<void> {
  const pluginId = req.params.pluginId
  if (typeof pluginId !== 'string' || !PLUGIN_ID.test(pluginId)) {
    res.status(404).json({ error: 'ERR_NOT_FOUND' })
    return
  }

  if (!isAllowListed(pluginId)) {
    res.status(404).json({ error: 'ERR_PLUGIN_NOT_ALLOWLISTED' })
    return
  }
  const target = resolveGatewayTarget(pluginId)
  if (target === undefined) {
    res.status(404).json({ error: 'ERR_PLUGIN_TARGET_NOT_ALLOWED' })
    return
  }

  const suffix = req.path.replace(/^\//, '')
  if (suffix.split('/').some((part) => part === '..' || part === '.')) {
    res.status(400).json({ error: 'ERR_INVALID_PLUGIN_PATH' })
    return
  }

  let body: string | undefined
  try {
    body = bodyForRequest(req)
  } catch {
    res.status(413).json({ error: 'ERR_PLUGIN_REQUEST_TOO_LARGE' })
    return
  }

  const requestUrl = req.originalUrl || req.url || ''
  const query = requestUrl.includes('?') ? `?${requestUrl.split('?')[1]}` : ''
  const url = `${target.replace(/\/$/, '')}/${suffix}${query}`
  const headers: Record<string, string> = { accept: String(req.headers.accept || '*/*') }
  if (body !== undefined) headers['content-type'] = String(req.headers['content-type'] || 'application/json')
  if (req.user) {
    headers['x-mynd-user-id'] = req.user.userId
    headers['x-mynd-role'] = req.user.role
    headers['x-mynd-session-id'] = req.user.sessionId
  }

  try {
    const health = await checkPluginHealth(target)
    if (health === 'unhealthy') {
      res.status(503).json({ error: 'ERR_PLUGIN_HOST_UNHEALTHY' })
      return
    }
    const requestInit: RequestInit = {
      method: req.method,
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }
    if (body !== undefined) requestInit.body = body
    const upstream = await fetch(url, requestInit)
    res.status(upstream.status)
    const contentType = upstream.headers.get('content-type')
    if (contentType) res.setHeader('content-type', contentType)
    const responseBody = Buffer.from(await upstream.arrayBuffer())
    res.send(responseBody)
  } catch (error) {
    const code = isTimeoutError(error) ? 'ERR_PLUGIN_HOST_TIMEOUT' : 'ERR_PLUGIN_HOST_UNAVAILABLE'
    res.status(502).json({ error: code })
  }
}

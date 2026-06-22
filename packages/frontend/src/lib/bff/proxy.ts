import type { NextRequest } from 'next/server'
import { buildBackendUrl } from './backend'

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
])

const BROWSER_STRIPPED_HEADERS = new Set([
  'authorization',
  'x-myndbbs-bff',
  'x-myndbbs-session-id',
])

function copyRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase()
    if (!HOP_BY_HOP_HEADERS.has(lowerKey) && !BROWSER_STRIPPED_HEADERS.has(lowerKey)) {
      headers.set(key, value)
    }
  })
  headers.set('x-myndbbs-bff', 'next')
  return headers
}

function isSafeMethod(method: string): boolean {
  return ['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method.toUpperCase())
}

function firstForwardedValue(value: string | null): string | null {
  return value?.split(',')[0]?.trim() || null
}

function normalizeOrigin(value: string | null): string | null {
  if (!value) return null

  try {
    const url = new URL(value)
    url.protocol = url.protocol.toLowerCase()
    url.hostname = url.hostname.toLowerCase()
    if (
      (url.protocol === 'https:' && url.port === '443') ||
      (url.protocol === 'http:' && url.port === '80')
    ) {
      url.port = ''
    }
    return url.origin
  } catch {
    return null
  }
}

function buildOrigin(protocol: string | null, host: string | null): string | null {
  if (!protocol || !host) return null
  const cleanProtocol = protocol.replace(/:$/, '').toLowerCase()
  if (cleanProtocol !== 'http' && cleanProtocol !== 'https') return null
  return normalizeOrigin(`${cleanProtocol}://${host}`)
}

function getTrustedRequestOrigins(request: NextRequest): Set<string> {
  const origins = new Set<string>()
  const addOrigin = (origin: string | null) => {
    const normalized = normalizeOrigin(origin)
    if (normalized) origins.add(normalized)
  }

  addOrigin(request.nextUrl.origin)

  const host = firstForwardedValue(request.headers.get('host'))
  const forwardedHost = firstForwardedValue(request.headers.get('x-forwarded-host')) || host
  const forwardedProto = firstForwardedValue(request.headers.get('x-forwarded-proto'))
  addOrigin(buildOrigin(forwardedProto, forwardedHost))

  if (!forwardedProto && request.headers.get('x-forwarded-ssl')?.toLowerCase() === 'on') {
    addOrigin(buildOrigin('https', forwardedHost))
  }

  // 反向代理终止 HTTPS 后，Next 容器内常看到 http://host，但浏览器 Origin 是 https://host。
  if (host) {
    addOrigin(buildOrigin(request.nextUrl.protocol, host))
    if (request.nextUrl.protocol === 'http:') {
      addOrigin(buildOrigin('https', host))
    }
  }

  return origins
}

function isAllowedMutationRequest(request: NextRequest): boolean {
  const origin = normalizeOrigin(request.headers.get('origin'))
  if (origin && !getTrustedRequestOrigins(request).has(origin)) {
    return false
  }

  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite === 'cross-site') {
    return false
  }

  return true
}

function copyResponseHeaders(response: Response): Headers {
  const headers = new Headers()
  response.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value)
    }
  })
  return headers
}

function getSetCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie()
  }

  const setCookie = headers.get('set-cookie')
  return setCookie ? [setCookie] : []
}

export async function proxyToBackend(request: NextRequest, backendPathname: string): Promise<Response> {
  const url = new URL(request.url)
  const backendUrl = buildBackendUrl(backendPathname, url.search)
  const method = request.method.toUpperCase()
  const hasBody = !['GET', 'HEAD'].includes(method)
  if (!isSafeMethod(method) && !isAllowedMutationRequest(request)) {
    return Response.json({ error: 'ERR_CSRF_ORIGIN_MISMATCH' }, { status: 403 })
  }

  const requestHeaders = copyRequestHeaders(request)
  if (!isSafeMethod(method) && !requestHeaders.has('x-requested-with')) {
    requestHeaders.set('x-requested-with', 'XMLHttpRequest')
  }

  const response = await fetch(backendUrl, {
    method,
    headers: requestHeaders,
    body: hasBody ? request.body : undefined,
    // Next.js 在转发表单上传和 SSE 时需要显式 half duplex。
    duplex: hasBody ? 'half' : undefined,
    redirect: 'manual',
  } as RequestInit)

  const responseHeaders = copyResponseHeaders(response)
  responseHeaders.delete('set-cookie')
  for (const cookie of getSetCookieHeaders(response)) {
    responseHeaders.append('set-cookie', cookie)
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

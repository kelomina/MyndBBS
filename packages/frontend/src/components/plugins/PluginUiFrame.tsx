'use client'

import { useEffect, useRef, useState } from 'react'
import { Code2 } from 'lucide-react'
import { fetchWithAuth } from '../../lib/api/fetcher'
import type { PluginUiMount } from '../../lib/api/admin'
import { useTranslation } from '../TranslationProvider'
import { Button } from '../ui/Button'

export const PLUGIN_UI_CSP = "default-src 'none'; connect-src 'none'; img-src data:; base-uri 'none'; form-action 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-src 'none'; object-src 'none'"
export type PluginReadRoute = { method: string; path: string }

export function allowedPluginRead(path: unknown, method: unknown, routes: readonly PluginReadRoute[]): path is string {
  return typeof path === 'string' && method === 'GET' && /^\/[a-zA-Z0-9_./-]+$/.test(path) && !path.includes('..') && !path.startsWith('//') && !path.startsWith('/__ui') && routes.some((route) => route.method === 'GET' && route.path === path)
}

// Parse without execution, put policy BEFORE all plugin markup and remove policy/base overrides.
export function isolatedPluginDocument(html: string, parentNonce = ''): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('base,meta[http-equiv]').forEach((element) => element.remove())
  const policy = doc.createElement('meta')
  policy.httpEquiv = 'Content-Security-Policy'
  policy.content = PLUGIN_UI_CSP
  doc.head.prepend(policy)
  if (parentNonce) doc.querySelectorAll('script:not([src]),style').forEach((element) => element.setAttribute('nonce', parentNonce))
  return `<!doctype html>${doc.documentElement.outerHTML}`
}

export async function limitedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) throw new Error('ERR_PLUGIN_UI_RESPONSE')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) throw new Error('ERR_PLUGIN_UI_RESPONSE_TOO_LARGE')
      chunks.push(value)
    }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return new TextDecoder().decode(bytes)
}

export function PluginUiFrame({ pluginId, mount, routes = [] }: { pluginId: string; mount: PluginUiMount; routes?: readonly PluginReadRoute[] }) {
  const dict = useTranslation()
  const text = dict.pluginPlatform
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const disposeRef = useRef<(() => void) | null>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    let live = true
    const timer = window.setTimeout(() => {
      setHtml(null); setError(false); initializedRef.current = false
      void (async () => {
        try {
          const path = mount.path.replace(/^\//, '')
          if (!path || path.split('/').some((part) => !part || part === '.' || part === '..') || !/^[a-zA-Z0-9_./-]+$/.test(path)) throw new Error('ERR_PLUGIN_UI_PATH')
          const response = await fetchWithAuth(`/api/plugins/${encodeURIComponent(pluginId)}/__ui/${path}`, { signal: controller.signal, cache: 'no-store', redirect: 'error' })
          if (!response.ok || !response.headers.get('content-type')?.toLowerCase().startsWith('text/html')) throw new Error('ERR_PLUGIN_UI_RESPONSE')
          const source = isolatedPluginDocument(await limitedText(response, 1024 * 1024), document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce ?? '')
          if (live) setHtml(source)
        } catch { if (live) setError(true) }
      })()
    }, 0)
    return () => { live = false; controller.abort(); window.clearTimeout(timer); disposeRef.current?.(); disposeRef.current = null }
  }, [pluginId, mount.path, attempt])

  const connect = () => {
    if (initializedRef.current || !html || !iframeRef.current?.contentWindow) return
    initializedRef.current = true
    const nonce = crypto.randomUUID()
    const channel = new MessageChannel()
    const controller = new AbortController()
    let closed = false
    let inFlight = 0
    let budget = 64
    disposeRef.current = () => { closed = true; controller.abort(); channel.port1.onmessage = null; channel.port1.close(); channel.port2.close() }
    channel.port1.onmessage = async ({ data }: MessageEvent<unknown>) => {
      if (!data || typeof data !== 'object') return
      const message = data as Record<string, unknown>
      if (message.type !== 'myndbbs:plugin:request' || message.nonce !== nonce || typeof message.id !== 'string' || message.id.length > 80 || closed) return
      const reply = (payload: Record<string, unknown>) => { if (!closed) channel.port1.postMessage({ type: 'myndbbs:plugin:response', id: message.id, nonce, ...payload }) }
      if (!allowedPluginRead(message.path, message.method, routes) || inFlight >= 4 || budget-- <= 0) { reply({ error: 'ERR_PLUGIN_BRIDGE_DENIED' }); return }
      inFlight++
      try {
        const response = await fetchWithAuth(`/api/plugins/${encodeURIComponent(pluginId)}${message.path}`, { method: 'GET', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]), cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json' } })
        if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) throw new Error('ERR_PLUGIN_BRIDGE_RESPONSE')
        const json: unknown = JSON.parse(await limitedText(response, 256 * 1024))
        reply({ data: json })
      } catch { reply({ error: 'ERR_PLUGIN_BRIDGE_RESPONSE' }) }
      finally { inFlight-- }
    }
    channel.port1.start()
    // '*' is necessary for an opaque sandbox origin; the transferred port + nonce are the capability.
    iframeRef.current.contentWindow.postMessage({ type: 'myndbbs:plugin:init', apiVersion: 2, pluginId, slot: mount.slot, nonce }, '*', [channel.port2])
  }

  return <section className="min-w-0 space-y-2 overflow-hidden rounded-lg border border-border bg-card p-3">
    <h3 className="flex min-w-0 items-start gap-2 text-xs font-medium text-muted-foreground"><Code2 className="h-4 w-4 shrink-0" /><span className="min-w-0 break-all">{pluginId} · {mount.slot}</span></h3>
    {error ? <div role="alert" className="space-y-2 text-sm"><p>{text.uiError}</p><Button type="button" size="sm" variant="outline" onClick={() => setAttempt((value) => value + 1)}>{text.retry}</Button></div> : html === null ? <p role="status" className="text-sm">{text.loading}</p> : <iframe key={attempt} ref={iframeRef} title={`${pluginId} ${mount.slot}`} srcDoc={html} sandbox="allow-scripts" referrerPolicy="no-referrer" onLoad={connect} className="h-64 w-full min-w-0 rounded border border-border bg-background" />}
  </section>
}

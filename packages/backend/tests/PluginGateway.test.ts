import { proxyPluginRequest } from '../src/infrastructure/plugins/PluginGateway'

describe('PluginGateway', () => {
  const response = () => {
    const result: { status?: number; headers: Record<string, string>; body?: unknown } = { headers: {} }
    return {
      result,
      status(code: number) { result.status = code; return this },
      setHeader(name: string, value: string) { result.headers[name] = value; return this },
      json(body: unknown) { result.body = body; return this },
      send(body: unknown) { result.body = body; return this },
    }
  }

  afterEach(() => {
    delete process.env.PLUGIN_ALLOWLIST
    delete process.env.PLUGIN_GATEWAY_MAP
    delete process.env.PLUGIN_GATEWAY_DNS_PREFIX
    jest.restoreAllMocks()
  })

  test('rejects plugins outside the server allow-list', async () => {
    process.env.PLUGIN_ALLOWLIST = 'safe-plugin'
    const res = response()
    await proxyPluginRequest({ params: { pluginId: 'unsafe-plugin' }, path: '/', url: '/', method: 'GET', headers: {} } as never, res as never)
    expect(res.result.status).toBe(404)
    expect(res.result.body).toEqual({ error: 'ERR_PLUGIN_NOT_ALLOWLISTED' })
  })

  test('forwards authenticated context only to the configured internal target', async () => {
    process.env.PLUGIN_ALLOWLIST = 'safe-plugin'
    process.env.PLUGIN_GATEWAY_MAP = JSON.stringify({ 'safe-plugin': 'http://myndbbs-plugin-safe-plugin:3500' })
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const res = response()
    await proxyPluginRequest({ params: { pluginId: 'safe-plugin' }, path: '/echo', url: '/echo?x=1', originalUrl: '/api/plugins/safe-plugin/echo?x=1', method: 'POST', headers: { 'content-type': 'application/json' }, body: { hello: 'world' }, user: { userId: 'u1', role: 'USER', sessionId: 's1', trustedExternalAuth: false, effectiveLevel: 1 } } as never, res as never)
    expect(fetchMock).toHaveBeenCalledWith('http://myndbbs-plugin-safe-plugin:3500/echo?x=1', expect.objectContaining({ method: 'POST', body: '{"hello":"world"}', headers: expect.objectContaining({ 'x-mynd-user-id': 'u1', 'x-mynd-role': 'USER', 'x-mynd-session-id': 's1' }) }))
    expect(res.result.status).toBe(200)
  })

  test('rejects public or literal IP gateway mappings before network access', async () => {
    process.env.PLUGIN_ALLOWLIST = 'safe-plugin'
    process.env.PLUGIN_GATEWAY_MAP = JSON.stringify({ 'safe-plugin': 'https://example.com:3500' })
    const fetchMock = jest.spyOn(global, 'fetch')
    const res = response()
    await proxyPluginRequest({ params: { pluginId: 'safe-plugin' }, path: '/', url: '/', method: 'GET', headers: {} } as never, res as never)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(res.result.status).toBe(404)
    expect(res.result.body).toEqual({ error: 'ERR_PLUGIN_TARGET_NOT_ALLOWED' })
  })

  test('rejects an internal mapping for a different plugin service', async () => {
    process.env.PLUGIN_ALLOWLIST = 'safe-plugin'
    process.env.PLUGIN_GATEWAY_MAP = JSON.stringify({ 'safe-plugin': 'http://myndbbs-plugin-other-plugin:3500' })
    const fetchMock = jest.spyOn(global, 'fetch')
    const res = response()
    await proxyPluginRequest({ params: { pluginId: 'safe-plugin' }, path: '/', url: '/', method: 'GET', headers: {} } as never, res as never)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(res.result.status).toBe(404)
    expect(res.result.body).toEqual({ error: 'ERR_PLUGIN_TARGET_NOT_ALLOWED' })
  })

  test('returns 503 when the allow-listed plugin reports unhealthy', async () => {
    process.env.PLUGIN_ALLOWLIST = 'safe-plugin'
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{"status":"unhealthy"}', { status: 503 }))
    const res = response()
    await proxyPluginRequest({ params: { pluginId: 'safe-plugin' }, path: '/echo', url: '/echo', method: 'GET', headers: {} } as never, res as never)
    expect(fetchMock).toHaveBeenCalledWith('http://myndbbs-plugin-safe-plugin:3500/healthz', expect.objectContaining({ method: 'GET' }))
    expect(res.result.status).toBe(503)
    expect(res.result.body).toEqual({ error: 'ERR_PLUGIN_HOST_UNHEALTHY' })
  })

  test('returns 502 when the plugin health probe is unreachable', async () => {
    process.env.PLUGIN_ALLOWLIST = 'safe-plugin'
    const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('connect ECONNREFUSED'))
    const res = response()
    await proxyPluginRequest({ params: { pluginId: 'safe-plugin' }, path: '/echo', url: '/echo', method: 'GET', headers: {} } as never, res as never)
    expect(fetchMock).toHaveBeenCalledWith('http://myndbbs-plugin-safe-plugin:3500/healthz', expect.objectContaining({ method: 'GET' }))
    expect(res.result.status).toBe(502)
    expect(res.result.body).toEqual({ error: 'ERR_PLUGIN_HOST_UNAVAILABLE' })
  })

  test('returns 502 when the plugin health probe times out', async () => {
    process.env.PLUGIN_ALLOWLIST = 'safe-plugin'
    const timeout = Object.assign(new Error('upstream timed out'), { name: 'TimeoutError' })
    const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValue(timeout)
    const res = response()
    await proxyPluginRequest({ params: { pluginId: 'safe-plugin' }, path: '/echo', url: '/echo', method: 'GET', headers: {} } as never, res as never)
    expect(fetchMock).toHaveBeenCalledWith('http://myndbbs-plugin-safe-plugin:3500/healthz', expect.objectContaining({ method: 'GET' }))
    expect(res.result.status).toBe(502)
    expect(res.result.body).toEqual({ error: 'ERR_PLUGIN_HOST_TIMEOUT' })
  })

  test('returns 502 when the business request is unreachable after a healthy probe', async () => {
    process.env.PLUGIN_ALLOWLIST = 'safe-plugin'
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockRejectedValueOnce(new Error('socket closed'))
    const res = response()
    await proxyPluginRequest({ params: { pluginId: 'safe-plugin' }, path: '/echo', url: '/echo', method: 'GET', headers: {} } as never, res as never)
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://myndbbs-plugin-safe-plugin:3500/echo', expect.objectContaining({ method: 'GET' }))
    expect(res.result.status).toBe(502)
    expect(res.result.body).toEqual({ error: 'ERR_PLUGIN_HOST_UNAVAILABLE' })
  })
})

import { proxyPluginRequest } from '../src/infrastructure/plugins/PluginGateway'
const manifest = {
  id: 'demo',
  version: '1.0.0',
  apiVersion: 2,
  entry: 'index.mjs',
  entrySha256: 'a'.repeat(64),
  signatureKeyId: 'test',
  capabilities: {
    routes: [
      { path: '/echo', methods: ['GET', 'POST'], auth: 'authenticated' },
      { path: '/admin', methods: ['GET'], auth: 'admin' },
    ],
    events: [],
    ui: [{ slot: 'admin.detail', path: 'ui/index.html' }],
  },
}
const user = { userId: 'u1', role: 'USER', sessionId: 's1' }
function response() {
  const result: { status?: number; body?: unknown; headers: Record<string, string> } = {
    headers: {},
  }
  return {
    result,
    status(value: number) {
      result.status = value
      return this
    },
    json(value: unknown) {
      result.body = value
      return this
    },
    send(value: unknown) {
      result.body = value
      return this
    },
    setHeader(k: string, v: string) {
      result.headers[k] = v
      return this
    },
  }
}
async function request(path = '/echo', overrides: Record<string, unknown> = {}) {
  const res = response()
  await proxyPluginRequest(
    {
      params: { pluginId: 'demo' },
      path,
      url: path,
      method: 'GET',
      user,
      headers: { cookie: 'raw-cookie', authorization: 'Bearer raw-token' },
      ...overrides,
    } as never,
    res as never,
  )
  return res.result
}
describe('v2 gateway', () => {
  beforeEach(() => {
    process.env.PLUGIN_CONTROL_URL = 'http://plugin-control:3600'
    process.env.PLUGIN_CONTROL_TOKEN = 'c'.repeat(32)
  })
  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.PLUGIN_CONTROL_URL
    delete process.env.PLUGIN_CONTROL_TOKEN
    delete process.env.PLUGIN_ALLOWLIST
  })
  const current = () =>
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(manifest)))
  test('requires authentication before network', async () => {
    const fetch = jest.spyOn(global, 'fetch')
    expect((await request('/echo', { user: undefined })).status).toBe(401)
    expect(fetch).not.toHaveBeenCalled()
  })
  test('has no legacy allowlist fallback', async () => {
    delete process.env.PLUGIN_CONTROL_URL
    process.env.PLUGIN_ALLOWLIST = 'demo'
    const fetch = jest.spyOn(global, 'fetch')
    expect((await request()).body).toEqual({ error: 'ERR_PLUGIN_CONTROL_UNAVAILABLE' })
    expect(fetch).not.toHaveBeenCalled()
  })
  test('only forwards sanitized identity and JSON to the supervisor', async () => {
    const fetch = current().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ status: 200, bodyBase64: Buffer.from('{}').toString('base64') }),
      ),
    )
    expect((await request('/echo', { method: 'POST', body: { hello: 'world' } })).status).toBe(200)
    const call = fetch.mock.calls[1]!
    expect(call[0]).toBe('http://plugin-control:3600/v1/plugins/demo/proxy')
    const payload = JSON.parse(String(call[1]?.body))
    expect(payload).toEqual({
      method: 'POST',
      path: '/echo',
      user: { id: 'u1', role: 'USER' },
      body: { hello: 'world' },
    })
    expect(JSON.stringify(call)).not.toMatch(/raw-cookie|raw-token|s1/)
  })
  test('does not route an undeclared method/path or insufficient role', async () => {
    current()
    expect((await request('/missing')).status).toBe(404)
    jest.restoreAllMocks()
    current()
    expect((await request('/echo', { method: 'DELETE' })).status).toBe(404)
    jest.restoreAllMocks()
    current()
    expect((await request('/admin')).status).toBe(403)
  })
  test.each(['/../x', '/%2e%2e/x', '/%2E%2E/x', '//evil', '/x\\y', '/x#y'])(
    'rejects unsafe path %s',
    async (pathname) => {
      const fetch = jest.spyOn(global, 'fetch')
      expect((await request(pathname)).status).toBe(400)
      expect(fetch).not.toHaveBeenCalled()
    },
  )
  test('serves only admin declared UI with sandbox CSP, never set-cookie', async () => {
    const fetch = current().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ status: 200, bodyBase64: Buffer.from('<p>UI</p>').toString('base64') }),
      ),
    )
    const result = await request('/__ui/ui/index.html', { user: { ...user, role: 'ADMIN' } })
    expect(result.status).toBe(200)
    expect(result.headers['content-security-policy']).toContain('sandbox allow-scripts')
    expect(result.headers['content-security-policy']).not.toContain('allow-same-origin')
    expect(result.headers['set-cookie']).toBeUndefined()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  test('hides admin UI from ordinary users', async () => {
    current()
    expect((await request('/__ui/ui/index.html')).status).toBe(404)
  })
  test('rejects v1 manifest', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ...manifest, apiVersion: 1 })))
    expect((await request()).body).toEqual({ error: 'ERR_INVALID_PLUGIN_MANIFEST' })
  })
  test('reports unavailability and timeout without direct host fallback', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(Object.assign(new Error('timeout'), { name: 'TimeoutError' }))
    expect((await request()).body).toEqual({ error: 'ERR_PLUGIN_HOST_TIMEOUT' })
  })
})

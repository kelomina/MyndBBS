// Targeted integration smoke: built Express router/controller/service + real auth/sudo middleware,
// mock session/DB infrastructure and a real HTTP fake supervisor. No Docker or database.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const Module = require('node:module')
const path = require('node:path')
const express = require('express')
const cookieParser = require('cookie-parser')

const copy = (v) => structuredClone(v)
const manifest = (version, secrets = ['/token']) => ({
  id: 'demo',
  version,
  apiVersion: 2,
  entry: 'index.mjs',
  entrySha256: 'a'.repeat(64),
  signatureKeyId: 'test',
  capabilities: {
    routes: [{ path: '/echo', methods: ['POST'], auth: 'admin' }],
    events: [],
    ui: [],
    config: {
      schema: {
        type: 'object',
        properties: { endpoint: { type: 'string' }, token: { type: 'string' } },
        required: ['endpoint'],
        additionalProperties: false,
      },
      secretPaths: secrets,
    },
  },
})
function mockDatabase() {
  let state = { plugins: [], releases: [], configs: [] },
    locked = false
  let failNextWrite = 0,
    transactions = 0
  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, value]) => {
      if (key === 'plugin')
        return state.plugins.some((p) => p.id === row.pluginId && matches(p, value))
      return value && typeof value === 'object' && 'in' in value
        ? value.in.includes(row[key])
        : row[key] === value
    })
  const make = (getState, tx = false) => {
    const db = {}
    for (const [name, table] of [
      ['plugin', 'plugins'],
      ['pluginRelease', 'releases'],
      ['pluginConfig', 'configs'],
    ]) {
      const rows = () => getState()[table]
      const decorate = (row, args) =>
        !row
          ? null
          : copy(
              args.include
                ? {
                    ...row,
                    releases: getState()
                      .releases.filter((r) => r.pluginId === row.id)
                      .reverse(),
                    config: getState().configs.find((c) => c.pluginId === row.id) ?? null,
                  }
                : row,
            )
      const check = () => {
        assert.equal(tx, true, 'all writes must be transactional')
        if (failNextWrite && --failNextWrite === 0) throw Error('DB injected failure')
      }
      db[name] = {
        findUnique: async (args) =>
          decorate(
            rows().find((r) => matches(r, args.where)),
            args,
          ),
        findFirst: async (args) =>
          decorate(
            (args.orderBy ? [...rows()].reverse() : rows()).find((r) => matches(r, args.where)),
            args,
          ),
        findMany: async (args = {}) =>
          rows()
            .filter((r) => matches(r, args.where))
            .map((r) => decorate(r, args)),
        create: async ({ data }) => {
          check()
          const row = {
            id: name + '-' + (rows().length + 1),
            healthy: null,
            lastHealthAt: null,
            lastError: null,
            currentVersion: null,
            approvedAt: null,
            activatedAt: null,
            uploadedAt: new Date(),
            ...copy(data),
          }
          rows().push(row)
          return copy(row)
        },
        update: async ({ where, data }) => {
          check()
          const row = rows().find((r) => matches(r, where))
          assert.ok(row)
          Object.assign(row, copy(data))
          return copy(row)
        },
        updateMany: async ({ where, data }) => {
          check()
          const found = rows().filter((r) => matches(r, where))
          for (const row of found) Object.assign(row, copy(data))
          return { count: found.length }
        },
        delete: async ({ where }) => {
          check()
          const row = rows().find((r) => matches(r, where))
          assert.ok(row)
          getState()[table] = rows().filter((r) => r !== row)
          if (name === 'plugin') {
            getState().releases = getState().releases.filter((r) => r.pluginId !== row.id)
            getState().configs = getState().configs.filter((r) => r.pluginId !== row.id)
          }
          return copy(row)
        },
        upsert: async ({ where, create, update }) =>
          rows().some((r) => matches(r, where))
            ? db[name].update({ where, data: update })
            : db[name].create({ data: create }),
      }
    }
    return db
  }
  const db = make(() => state)
  db.$transaction = async (callback, options) => {
    assert.equal(options.timeout, 90000)
    transactions++
    let owns = false,
      draft = copy(state)
    const tx = make(() => draft, true)
    tx.$queryRaw = async (sql, key) => {
      assert.match(sql.join('?'), /pg_try_advisory_xact_lock/)
      assert.equal(typeof key, 'string')
      if (locked && !owns) return [{ locked: false }]
      locked = owns = true
      return [{ locked: true }]
    }
    try {
      const result = await callback(tx)
      state = draft
      return result
    } finally {
      if (owns) locked = false
    }
  }
  return {
    db,
    state: () => state,
    fail: (n = 1) => {
      failNextWrite = n
    },
    transactions: () => transactions,
  }
}
const listen = (server) =>
  new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve('http://127.0.0.1:' + server.address().port)),
  )
const close = (server) =>
  new Promise((resolve) => {
    server.closeAllConnections()
    server.close(resolve)
  })

test('plugin platform actual HTTP lifecycle/authorization/config/transaction smoke', async (t) => {
  const database = mockDatabase(),
    calls = [],
    audits = []
  let runtime = { pluginId: 'demo', state: 'DISABLED', healthy: false },
    failAction,
    unhealthyAction,
    failHealth = false,
    gate,
    arrived
  const supervisor = http.createServer(async (req, res) => {
    assert.equal(req.headers['x-plugin-control-token'], 'test-control')
    let data = ''
    for await (const chunk of req) data += chunk
    const body = data ? JSON.parse(data) : {},
      action = req.method === 'DELETE' ? 'remove' : req.url.split('/').at(-1)
    calls.push({ action, body })
    res.setHeader('content-type', 'application/json')
    if (action === 'activate' && gate) {
      arrived()
      await gate
    }
    if (action === failAction || (action === 'health' && failHealth)) {
      res.statusCode = 503
      res.end(JSON.stringify({ error: 'ERR_PLUGIN_CONTROL_FAILED' }))
      return
    }
    if (action === 'stage') {
      const m = JSON.parse(Buffer.from(body.archiveBase64, 'base64'))
      res.end(
        JSON.stringify({
          pluginId: m.id,
          version: m.version,
          manifest: m,
          artifactSha256: 'b'.repeat(64),
        }),
      )
      return
    }
    if (action === unhealthyAction) {
      res.end(JSON.stringify({ ...runtime, version: body.version, healthy: false }))
      return
    }
    if (action === 'activate' || action === 'rollback')
      runtime = { pluginId: 'demo', version: body.version, state: 'ACTIVE', healthy: true }
    if (action === 'deactivate') runtime = { ...runtime, state: 'DISABLED', healthy: false }
    if (action === 'remove') {
      if (runtime.state !== 'DISABLED') {
        res.statusCode = 409
        res.end(JSON.stringify({ error: 'ERR_PLUGIN_MUST_BE_DISABLED' }))
        return
      }
      runtime = { pluginId: 'demo', state: 'DELETED', healthy: false }
    }
    res.end(
      JSON.stringify({
        ...runtime,
        container: 'private-container',
        generation: 'private-generation',
      }),
    )
  })
  const originalEnv = {
    url: process.env.PLUGIN_CONTROL_URL,
    token: process.env.PLUGIN_CONTROL_TOKEN,
    key: process.env.PLUGIN_CONFIG_ENCRYPTION_KEY,
  }
  t.after(async () => {
    if (supervisor.listening) await close(supervisor)
  })
  process.env.PLUGIN_CONTROL_URL = await listen(supervisor)
  process.env.PLUGIN_CONTROL_TOKEN = 'test-control'
  process.env.PLUGIN_CONFIG_ENCRYPTION_KEY = 'a'.repeat(64)
  const noop = (_req, _res, next) => next()
  const registry = {
    auditApplicationService: {
      logAudit: async (...args) => {
        audits.push(args)
      },
    },
    authCache: {
      getSessionValidity: async () => 'valid',
      setSessionValidity: async () => {},
      hasTrustedExternalAuth: async () => false,
    },
    authApplicationService: {
      validateSession: async (id) => ({
        isValid: true,
        user: { id: 'operator' },
        roleName: id.split(':')[0],
      }),
    },
    sudoApplicationService: { check: async (id) => id.endsWith(':sudo') },
  }
  const originalLoad = Module._load
  Module._load = function (request, parent, isMain) {
    const file = parent?.filename?.replaceAll('\\', '/') || ''
    if (file.includes('/backend/dist/')) {
      if (request === '../../db') return { prisma: database.db }
      if (request.endsWith('/registry')) return registry
      if (request.endsWith('/lib/casl'))
        return { defineAbilityForContext: () => ({ can: () => true }) }
      if (request.endsWith('/lib/rateLimit'))
        return { getClientIp: (req) => require('express-rate-limit').ipKeyGenerator(req.ip) }
      if (request.endsWith('/PluginEventBridge'))
        return { pluginEventBridge: { backlog: async () => [] } }
      if (request.endsWith('/AccessControlQueryService'))
        return { accessControlQueryService: { getAbilityRulesForUser: async () => null } }
      if (file.endsWith('/routes/admin.js')) {
        if (request.startsWith('../controllers/') && request !== '../controllers/plugins')
          return new Proxy({}, { get: () => noop })
        if (request === '../middleware/validation') return { validate: () => noop }
        if (request === '../lib/validation/schemas') return {}
        if (request.endsWith('/StatsQueryService')) return { statsQueryService: {} }
      }
    }
    return originalLoad.call(this, request, parent, isMain)
  }
  let router
  try {
    router = require('../dist/routes/admin').default
  } finally {
    Module._load = originalLoad
  }
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/admin', router)
  const api = http.createServer(app),
    base = await listen(api)
  t.after(async () => {
    if (api.listening) await close(api)
  })
  const request = async (method, suffix, body, role = 'SUPER_ADMIN:sudo') => {
    const headers = { ...(role ? { cookie: 'sessionId=' + role } : {}) }
    if (body !== undefined) headers['content-type'] = 'application/json'
    const response = await fetch(base + '/api/admin/plugins' + suffix, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    return { status: response.status, body: await response.json() }
  }
  const upload = async (version, secretPaths) => {
    const form = new FormData()
    form.append(
      'artifact',
      new Blob([JSON.stringify(manifest(version, secretPaths))]),
      'demo.tar.gz',
    )
    form.append('signature', Buffer.alloc(64).toString('base64'))
    const response = await fetch(base + '/api/admin/plugins/releases', {
      method: 'POST',
      headers: { cookie: 'sessionId=SUPER_ADMIN:sudo' },
      body: form,
    })
    assert.equal(response.status, 201)
    return response.json()
  }
  try {
    await t.test('real hidden authentication, role matrix and sudo gate', async () => {
      for (const role of ['', 'USER', 'MODERATOR'])
        assert.equal((await request('GET', '', undefined, role)).status, 404)
      for (const role of ['ADMIN', 'SUPER_ADMIN'])
        assert.equal((await request('GET', '', undefined, role)).status, 200)
      for (const [method, suffix, body] of [
        ['POST', '/demo/activate', {}],
        ['POST', '/demo/rollback', { version: '1' }],
        ['PUT', '/demo/config', {}],
        ['DELETE', '/demo'],
        ['POST', '/demo/releases/id/approve', {}],
        ['POST', '/demo/reload', {}],
        ['POST', '/demo/deactivate', {}],
      ]) {
        assert.equal((await request(method, suffix, body, 'ADMIN:sudo')).status, 404)
        const denied = await request(method, suffix, body, 'SUPER_ADMIN')
        assert.equal(denied.status, 403)
        assert.equal(denied.body.error, 'ERR_SUDO_REQUIRED')
      }
      assert.equal(calls.length, 0)
    })
    await t.test(
      'quarantine -> approval -> pre-activation masked config -> activation delivers plaintext + digest',
      async () => {
        const staged = await upload('1.0.0')
        assert.equal(staged.runtimeState, 'PENDING_APPROVAL')
        assert.equal((await request('POST', '/demo/activate', {})).status, 400)
        assert.equal(
          (await request('POST', '/demo/releases/' + staged.releases[0].id + '/approve', {}))
            .status,
          200,
        )
        assert.equal(calls.at(-1).action, 'approve')
        assert.equal(calls.at(-1).body.artifactSha256, 'b'.repeat(64))
        const config = await request('PUT', '/demo/config', {
          endpoint: 'first',
          token: 'real-secret',
        })
        assert.equal(config.status, 200)
        assert.equal(config.body.config.token, '********')
        assert.equal(database.state().configs[0].publicConfig.token, undefined)
        assert.ok(!database.state().configs[0].encryptedSecrets.includes('real-secret'))
        const activated = await request('POST', '/demo/activate', {})
        assert.equal(activated.status, 200)
        assert.equal(activated.body.currentVersion, '1.0.0')
        assert.equal(activated.body.healthy, true)
        assert.ok(activated.body.lastHealthAt)
        assert.deepEqual(activated.body.routeCapabilities, [
          { path: '/echo', methods: ['POST'], auth: 'admin' },
        ])
        assert.equal(calls.at(-1).body.config.token, 'real-secret')
        assert.equal(calls.at(-1).body.artifactSha256, 'b'.repeat(64))
      },
    )
    await t.test(
      'approval never overwrites ACTIVE; masks preserve secrets; reload delivers config',
      async () => {
        const staged = await upload('2.0.0')
        const approved = await request(
          'POST',
          '/demo/releases/' + staged.releases[0].id + '/approve',
          {},
        )
        assert.equal(approved.body.runtimeState, 'ACTIVE')
        assert.equal(approved.body.currentVersion, '1.0.0')
        await request('PUT', '/demo/config', { endpoint: 'second', token: '********' })
        assert.equal((await request('POST', '/demo/reload', {})).status, 200)
        assert.equal(calls.at(-1).body.config.token, 'real-secret')
      },
    )
    await t.test(
      'unhealthy candidate and thrown activate preserve current release and old health',
      async () => {
        for (const mode of ['throw', 'unhealthy']) {
          failAction = mode === 'throw' ? 'activate' : undefined
          unhealthyAction = mode === 'unhealthy' ? 'activate' : undefined
          assert.equal((await request('POST', '/demo/activate', { version: '2.0.0' })).status, 503)
          const old = (await request('GET', '/demo')).body
          assert.equal(old.currentVersion, '1.0.0')
          assert.equal(old.runtimeState, 'ACTIVE')
          assert.equal(old.healthy, true)
          assert.equal(old.releases.find((r) => r.version === '2.0.0').state, 'APPROVED')
        }
        failAction = unhealthyAction = undefined
      },
    )
    await t.test(
      'concurrent operations conflict before supervisor mutation; release transition is atomic',
      async () => {
        let release
        gate = new Promise((resolve) => {
          release = resolve
        })
        const seen = new Promise((resolve) => {
          arrived = resolve
        })
        const pending = request('POST', '/demo/activate', { version: '2.0.0' })
        await seen
        const conflict = await request('POST', '/demo/deactivate', {})
        assert.equal(conflict.status, 409)
        assert.equal(conflict.body.error, 'ERR_PLUGIN_OPERATION_IN_PROGRESS')
        assert.equal((await request('GET', '/demo')).body.currentVersion, '1.0.0')
        release()
        gate = undefined
        const active = await pending
        assert.equal(active.body.currentVersion, '2.0.0')
        assert.equal(active.body.releases.filter((r) => r.state === 'ACTIVE').length, 1)
      },
    )
    await t.test(
      'rollback failure/reload failure preserve version; rollback supplies decrypted config',
      async () => {
        for (const action of ['rollback', 'reload']) {
          failAction = action
          assert.equal((await request('POST', '/demo/' + action, { version: '1.0.0' })).status, 503)
          assert.equal((await request('GET', '/demo')).body.currentVersion, '2.0.0')
        }
        failAction = undefined
        const rolled = await request('POST', '/demo/rollback', { version: '1.0.0' })
        assert.equal(rolled.body.runtimeState, 'ROLLED_BACK')
        assert.equal(rolled.body.currentVersion, '1.0.0')
        assert.equal(calls.at(-1).body.config.token, 'real-secret')
      },
    )
    await t.test(
      'health failure is unknown not healthy; decrypt failure never reaches supervisor',
      async () => {
        failHealth = true
        assert.equal((await request('GET', '/demo/health')).status, 503)
        const unknown = (await request('GET', '/demo')).body
        assert.equal(unknown.healthy, null)
        assert.equal(unknown.runtimeState, 'UNHEALTHY')
        failHealth = false
        const health = await request('GET', '/demo/health')
        assert.equal(health.status, 200)
        assert.equal(health.body.container, undefined)
        assert.equal(health.body.generation, undefined)
        const row = database.state().configs[0],
          saved = row.encryptedSecrets,
          count = calls.length
        row.encryptedSecrets = 'broken'
        assert.equal((await request('POST', '/demo/reload', {})).status, 400)
        assert.equal(calls.length, count)
        row.encryptedSecrets = saved
      },
    )
    await t.test(
      'mid-transaction row failure rolls back all rows and compensates old runtime',
      async () => {
        const before = copy(database.state())
        database.fail(2)
        assert.equal((await request('POST', '/demo/rollback', { version: '2.0.0' })).status, 500)
        assert.deepEqual(database.state(), before)
        assert.equal(runtime.version, before.plugins[0].currentVersion)
      },
    )
    await t.test(
      'schema change drops old secret rather than exposing it as a plain field',
      async () => {
        const staged = await upload('3.0.0', [])
        await request('POST', '/demo/releases/' + staged.releases[0].id + '/approve', {})
        assert.equal((await request('POST', '/demo/activate', { version: '3.0.0' })).status, 200)
        assert.equal(calls.at(-1).body.config.token, undefined)
        assert.equal((await request('GET', '/demo/config')).body.config.token, undefined)
        assert.equal((await request('GET', '/demo')).body.config.token, undefined)
      },
    )
    await t.test(
      'failed stop keeps active intent; DELETE requires DISABLED and health cannot reactivate',
      async () => {
        failAction = 'deactivate'
        assert.equal((await request('POST', '/demo/deactivate', {})).status, 503)
        assert.equal((await request('GET', '/demo')).body.desiredState, 'ACTIVE')
        failAction = undefined
        assert.equal((await request('DELETE', '/demo')).status, 409)
        const stopped = await request('POST', '/demo/deactivate', {})
        assert.equal(stopped.status, 200)
        assert.equal(stopped.body.runtimeState, 'DISABLED')
        assert.equal(stopped.body.releases.length, 3)
        assert.equal(database.state().configs.length, 1)
        await request('GET', '/demo/health')
        assert.equal((await request('GET', '/demo')).body.runtimeState, 'DISABLED')
        assert.equal((await request('POST', '/demo/reload', {})).status, 409)
      },
    )
    await t.test(
      'direct remove adapter uses POST remove; HTTP client never auto-selects fake',
      async () => {
        const {
          HttpPluginControlClient,
          pluginControlClient,
          FakePluginControlPort,
        } = require('../dist/infrastructure/plugins/PluginControlPort')
        assert.ok(pluginControlClient() instanceof HttpPluginControlClient)
        assert.ok(!(pluginControlClient() instanceof FakePluginControlPort))
        const snapshot = await new HttpPluginControlClient().remove('demo')
        assert.equal(snapshot.state, 'DELETED')
        assert.equal(calls.at(-1).action, 'remove')
        assert.deepEqual(calls.at(-1).body, {})
      },
    )
    await t.test('multi-row DB write failure rolls back without partial approval', async () => {
      const staged = await upload('4.0.0'),
        before = copy(database.state())
      database.fail()
      assert.equal(
        (await request('POST', '/demo/releases/' + staged.releases[0].id + '/approve', {})).status,
        500,
      )
      assert.deepEqual(database.state(), before)
      assert.ok(database.transactions() > 15)
    })
    await t.test(
      'DELETE removes disabled plugin plus release/config metadata, but emits audit',
      async () => {
        runtime = { pluginId: 'demo', state: 'DISABLED', healthy: false }
        const removed = await request('DELETE', '/demo')
        assert.equal(removed.status, 200)
        assert.deepEqual(removed.body, { pluginId: 'demo', deleted: true })
        assert.equal(calls.at(-1).action, 'remove')
        assert.deepEqual(calls.at(-1).body, {})
        assert.equal((await request('GET', '/demo')).status, 404)
        assert.equal(database.state().plugins.length, 0)
        assert.equal(database.state().releases.length, 0)
        assert.equal(database.state().configs.length, 0)
        assert.ok(audits.some((entry) => entry[1] === 'PLUGIN_REMOVE'))
      },
    )
  } finally {
    await close(api)
    await close(supervisor)
    for (const [name, value] of [
      ['PLUGIN_CONTROL_URL', originalEnv.url],
      ['PLUGIN_CONTROL_TOKEN', originalEnv.token],
      ['PLUGIN_CONFIG_ENCRYPTION_KEY', originalEnv.key],
    ]) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
})

import type Redis from 'ioredis'
import { PluginEventBridge } from '../src/infrastructure/plugins/PluginEventBridge'
import { InMemoryEventBus } from '../src/infrastructure/events/InMemoryEventBus'
import { PostApprovedEvent } from '../src/domain/shared/events/DomainEvents'
import type { PluginControlPort } from '../src/infrastructure/plugins/PluginControlPort'

jest.mock('../src/db', () => ({ prisma: {} }))
jest.mock('../src/infrastructure/events/EventBusFactory', () => ({ getEventBus: () => ({ publish: jest.fn(), subscribe: jest.fn() }) }))

type Row = {
  id: string; pluginId: string; eventId: string; eventName: string; schemaVersion: number
  payload: any; state: string; attempts: number; availableAt: Date; createdAt: Date
  lastAttemptAt?: Date; deliveredAt?: Date; lastError?: string | null
}
const manifest = () => ({ id: 'demo', version: '1.0.0', apiVersion: 2, entry: 'index.mjs',
  entrySha256: 'a'.repeat(64), signatureKeyId: 'release-key',
  capabilities: { routes: [], events: [{ name: 'PostApprovedEvent', version: 1 }], ui: [] } })
const fixturePlugin = (id = 'db-demo') => ({ id, pluginId: id, desiredState: 'ACTIVE', runtimeState: 'ACTIVE', currentVersion: '1.0.0',
  releases: [{ version: '1.0.0', state: 'ACTIVE', manifest: manifest() }] })

// Stateful DB fake checks the production CAS predicate, not just call counts.
function database() {
  const rows: Row[] = []
  const plugins = [fixturePlugin()]
  let failUpsert = false
  function matches(row: Row, where: any): boolean {
    return Object.entries(where).every(([key, value]: [string, any]) => {
      if (key === 'plugin') return plugins.find((plugin) => plugin.id === row.pluginId)?.pluginId === value.pluginId
      const actual = (row as any)[key]
      const isDate = (item: unknown) => Object.prototype.toString.call(item) === '[object Date]'
      if (value && typeof value === 'object' && !isDate(value)) {
        if ('in' in value) return value.in.includes(actual)
        if ('lte' in value) return actual <= value.lte
      }
      return isDate(actual) && isDate(value) ? actual.getTime() === value.getTime() : actual === value
    })
  }
  const db: any = {
    plugin: {
      findMany: jest.fn(async () => structuredClone(plugins)),
      findUnique: jest.fn(async ({ where }: any) => structuredClone(plugins.find((p) => p.id === where.id) ?? null)),
    },
    pluginEventDelivery: {
      findMany: jest.fn(async ({ where, take }: any) => structuredClone(rows.filter((r) => matches(r, where)).sort((a, b) => +a.availableAt - +b.availableAt).slice(0, take))),
      count: jest.fn(async ({ where }: any) => rows.filter((r) => matches(r, where)).length),
      upsert: jest.fn(async ({ create }: any) => {
        if (failUpsert) throw new Error('database down')
        let row = rows.find((r) => r.pluginId === create.pluginId && r.eventId === create.eventId)
        if (!row) {
          row = { ...structuredClone(create), id: 'row-' + rows.length, attempts: 0, availableAt: new Date(), createdAt: new Date() }
          rows.push(row!)
        }
        return row
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const matched = rows.filter((r) => matches(r, where))
        for (const row of matched) {
          const attempts = data.attempts ? row.attempts + data.attempts.increment : row.attempts
          Object.assign(row, structuredClone(data), { attempts })
        }
        return { count: matched.length }
      }),
    },
    $transaction: jest.fn(async (action: any) => {
      const before = structuredClone(rows)
      try { return await action(db) }
      catch (error) { rows.splice(0, rows.length, ...before); throw error }
    }),
  }
  return { db, rows, plugins, fail: (value: boolean) => { failUpsert = value } }
}

const event = () => new PostApprovedEvent('p1', 'u1', 'private title')
function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
async function flush() { for (let i = 0; i < 60; i++) await Promise.resolve() }
function fixture(store = database(), stream?: MockStream) {
  const bus = new InMemoryEventBus()
  const deliver = jest.fn(async () => {})
  const bridge = new PluginEventBridge(bus, { deliverEvent: deliver } as unknown as PluginControlPort, store.db,
    () => stream as unknown as Redis | undefined)
  return { store, bus, deliver, bridge }
}

type Message = [string, string[]]
class MockStream {
  pending = new Map<string, Message>()
  fresh: Message[] = []
  cursors: string[] = []
  nextCursor = '0-0'
  offline = false
  failAck = false
  read = deferred<any>()
  xgroup = jest.fn(async () => { if (this.offline) throw new Error('offline'); return 'OK' })
  on = jest.fn()
  call = jest.fn(async (...args: any[]) => {
    if (this.offline) throw new Error('offline')
    expect(args[0]).toBe('XAUTOCLAIM')
    expect(args[2]).toBe('myndbbs-plugin-bridge')
    this.cursors.push(args[5])
    return [this.nextCursor, [...this.pending.values()], []]
  })
  xreadgroup = jest.fn(async (...args: any[]) => {
    expect(args[1]).toBe('myndbbs-plugin-bridge')
    if (this.offline) throw new Error('offline')
    if (this.fresh.length) {
      const batch = this.fresh.splice(0)
      for (const msg of batch) this.pending.set(msg[0], msg)
      return [['myndbbs:events', batch]]
    }
    return this.read.promise
  })
  xack = jest.fn(async (_key: string, _group: string, id: string) => {
    if (this.failAck) { this.failAck = false; throw new Error('ack lost') }
    this.pending.delete(id)
    return 1
  })
  disconnect = jest.fn(() => this.read.resolve(null))
}
function message(value = event()): Message { return ['1-0', ['payload', JSON.stringify(value)]] }

beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-02T00:00:00Z')); jest.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

describe('PluginEventBridge durable delivery smoke', () => {
  test('a healthy rolled-back release keeps its active event subscriptions', async () => {
    const { bridge, store, deliver } = fixture()
    store.plugins[0]!.runtimeState = 'ROLLED_BACK'
    await bridge.enqueue(event())
    expect(store.db.plugin.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ runtimeState: { in: ['ACTIVE', 'ROLLED_BACK', 'UNHEALTHY'] } }) }))
    await bridge.processPending()
    expect(deliver).toHaveBeenCalledTimes(1)
    expect(store.rows[0]?.state).toBe('DELIVERED')
  })

  test('double allowlist, DB uniqueness and duplicate replay do not reset delivered rows', async () => {
    const { bridge, store, deliver } = fixture()
    store.plugins.push(fixturePlugin('undeclared'))
    store.plugins[1]!.releases[0]!.manifest.capabilities.events = []
    const value = event()
    await Promise.all([bridge.enqueue(value), bridge.enqueue(value)])
    expect(store.rows).toHaveLength(1)
    await bridge.enqueue({ eventName: 'DbConfigUpdatedEvent', occurredOn: new Date() })
    expect(store.rows).toHaveLength(1)
    await bridge.processPending()
    await bridge.enqueue(value)
    await bridge.processPending()
    expect(deliver).toHaveBeenCalledTimes(1)
    expect(store.rows[0]).toMatchObject({ state: 'DELIVERED', attempts: 1, lastAttemptAt: new Date() })
  })

  test('publish persists before acceptance, never awaits a slow plugin, and DB failure is not swallowed', async () => {
    const { bridge, bus, store, deliver } = fixture()
    const blocked = deferred()
    deliver.mockImplementation(() => blocked.promise)
    bridge.start()
    await flush()
    await bus.publish(event())
    expect(store.rows).toHaveLength(1)
    const worker = bridge.processPending()
    await flush()
    expect(deliver).toHaveBeenCalledTimes(1)
    await bus.publish(new PostApprovedEvent('p2', 'u1', 'private'))
    expect(store.rows).toHaveLength(2)
    expect(await bridge.backlog()).toEqual({ pending: 2, failed: 0, deadLetter: 0 })
    store.fail(true)
    await expect(bus.publish(new PostApprovedEvent('p3', 'u1', 'private'))).rejects.toThrow('database down')
    blocked.resolve()
    await worker
    await bridge.stop()
  })

  test('two workers cannot claim the same row concurrently', async () => {
    const first = fixture()
    const second = fixture(first.store)
    const gate = deferred()
    first.deliver.mockImplementation(() => gate.promise)
    await first.bridge.enqueue(event())
    const one = first.bridge.processPending()
    const two = second.bridge.processPending()
    await flush()
    expect(first.deliver.mock.calls.length + second.deliver.mock.calls.length).toBe(1)
    gate.resolve()
    await Promise.all([one, two])
    expect(first.store.rows[0]!.attempts).toBe(1)
  })

  test('expired DELIVERING lease is reclaimed after restart; late old owner cannot finalize', async () => {
    const first = fixture()
    const second = fixture(first.store)
    const old = deferred()
    const newer = deferred()
    first.deliver.mockImplementation(() => old.promise)
    second.deliver.mockImplementation(() => newer.promise)
    await first.bridge.enqueue(event())
    const a = first.bridge.processPending()
    await flush()
    jest.setSystemTime(Date.now() + 60001)
    const b = second.bridge.processPending()
    await flush()
    expect(first.store.rows[0]).toMatchObject({ state: 'DELIVERING', attempts: 2 })
    old.resolve()
    await a
    expect(first.store.rows[0]!.state).toBe('DELIVERING')
    newer.resolve()
    await b
    expect(first.store.rows[0]!.state).toBe('DELIVERED')
  })

  test('bounded timeout, exponential retry and terminal dead-letter preserve delivery metadata', async () => {
    const { bridge, store, deliver } = fixture()
    deliver.mockRejectedValue(new Error('SECRET raw plugin error'))
    await bridge.enqueue(event())
    for (let attempt = 1; attempt <= 10; attempt++) {
      await bridge.processPending()
      const row = store.rows[0]!
      expect(row.attempts).toBe(attempt)
      expect(row.lastError).toBe('ERR_PLUGIN_EVENT_DELIVERY_FAILED')
      expect(row.availableAt.getTime() - Date.now()).toBe(Math.min(300000, 1000 * 2 ** Math.min(attempt, 9)))
      if (attempt < 10) {
        await bridge.processPending()
        expect(deliver).toHaveBeenCalledTimes(attempt)
        jest.setSystemTime(row.availableAt)
      }
    }
    expect(await bridge.backlog()).toEqual({ pending: 0, failed: 0, deadLetter: 1 })
    await bridge.processPending()
    expect(deliver).toHaveBeenCalledTimes(10)
  })

  test('hung control times out and does not serialize a healthy plugin', async () => {
    const { bridge, store, deliver } = fixture()
    store.plugins.push(fixturePlugin('healthy'))
    deliver.mockImplementationOnce(() => new Promise<void>(() => {}))
    await bridge.enqueue(event())
    const task = bridge.processPending()
    await flush()
    expect(store.rows[1]!.state).toBe('DELIVERED')
    await jest.advanceTimersByTimeAsync(15000)
    await task
    expect(store.rows[0]!.state).toBe('FAILED')
  })

  test.each(['disabled', 'removed', 'capability', 'version', 'catalog'])(
    'rechecks %s after enqueue; a queued event is never sent on stale authority', async (change) => {
      const { bridge, store, deliver } = fixture()
      await bridge.enqueue(event())
      const plugin = store.plugins[0]!
      if (change === 'disabled') plugin.desiredState = 'DISABLED'
      if (change === 'removed') store.plugins.splice(0)
      if (change === 'capability') plugin.releases[0]!.manifest.capabilities.events = []
      if (change === 'version') plugin.releases[0]!.manifest.capabilities.events[0]!.version = 2
      if (change === 'catalog') store.rows[0]!.eventName = 'NotInCatalogEvent'
      await bridge.processPending()
      expect(deliver).not.toHaveBeenCalled()
      expect(store.rows[0]).toMatchObject({ state: 'DEAD_LETTER', lastError: 'ERR_PLUGIN_EVENT_CAPABILITY_REVOKED' })
    })

  test('historical persisted DTO is redacted again immediately before control delivery', async () => {
    const { bridge, store, deliver } = fixture()
    await bridge.enqueue(event())
    store.rows[0]!.payload.payload.email = 'SECRET'
    store.rows[0]!.payload.payload.nested = { value: 'SECRET' }
    await bridge.processPending()
    expect(JSON.stringify(deliver.mock.calls)).not.toContain('SECRET')
  })

  test('Redis offline publish survives a worker restart in the DB outbox', async () => {
    const stream = new MockStream()
    stream.offline = true
    const first = fixture(database(), stream)
    first.bridge.start()
    await flush()
    await first.bus.publish(event())
    const stopped = first.bridge.stop()
    await jest.advanceTimersByTimeAsync(1000)
    await stopped
    const second = fixture(first.store)
    await second.bridge.processPending()
    expect(second.deliver).toHaveBeenCalledTimes(1)
    expect(first.store.rows[0]!.state).toBe('DELIVERED')
  })

  test('independent Stream group persists before ACK, then duplicate/restart PEL is idempotent', async () => {
    const stream = new MockStream()
    const msg = message()
    stream.pending.set(msg[0], msg)
    stream.failAck = true
    const first = fixture(database(), stream)
    first.bridge.start()
    await flush()
    expect(first.store.rows).toHaveLength(1)
    expect(stream.pending.size).toBe(1)
    await first.bridge.stop()
    const restarted = new MockStream()
    restarted.pending = stream.pending
    const second = fixture(first.store, restarted)
    second.bridge.start()
    await flush()
    expect(restarted.pending.size).toBe(0)
    expect(first.store.rows).toHaveLength(1)
    expect(restarted.xack).toHaveBeenCalledWith('myndbbs:events', 'myndbbs-plugin-bridge', '1-0')
    await second.bridge.stop()
  })

  test('failed DB transaction never ACKs; reconnection retries and cursor advances', async () => {
    const stream = new MockStream()
    stream.fresh.push(message())
    stream.nextCursor = '22-0'
    const { bridge, store } = fixture(database(), stream)
    store.fail(true)
    bridge.start()
    await flush()
    expect(stream.xack).not.toHaveBeenCalled()
    expect(store.rows).toHaveLength(0)
    expect(stream.pending.size).toBe(1)
    store.fail(false)
    stream.read.resolve(null)
    stream.read = deferred()
    await flush()
    expect(stream.xack).toHaveBeenCalledTimes(1)
    expect(stream.cursors).toContain('22-0')
    expect(store.rows).toHaveLength(1)
    await bridge.stop()
  })

  test('reconnect resumes the loop and start/stop does not stack wrappers or subscribers', async () => {
    const stream = new MockStream()
    stream.offline = true
    const { bridge, bus, store } = fixture(database(), stream)
    const originalPublish = bus.publish
    const subscribe = jest.spyOn(bus, 'subscribe')
    bridge.start()
    bridge.start()
    await flush()
    stream.offline = false
    stream.fresh.push(message())
    await jest.advanceTimersByTimeAsync(1000)
    await flush()
    expect(stream.pending.size).toBe(0)
    expect(store.rows).toHaveLength(1)
    await bridge.stop()
    expect(bus.publish).toBe(originalPublish)
    expect(subscribe).not.toHaveBeenCalled()
  })
  test('multi-plugin fanout rolls back entirely if one delivery insert fails, then retries both', async () => {
    const { bridge, store } = fixture()
    store.plugins.push(fixturePlugin('second'))
    const upsert = store.db.pluginEventDelivery.upsert.getMockImplementation()
    store.db.pluginEventDelivery.upsert.mockImplementation(async (args: any) => {
      if (args.create.pluginId === 'second') throw new Error('second insert unavailable')
      return upsert(args)
    })
    const value = event()
    await expect(bridge.enqueue(value)).rejects.toThrow('second insert unavailable')
    expect(store.rows).toHaveLength(0)
    store.db.pluginEventDelivery.upsert.mockImplementation(upsert)
    await bridge.enqueue(value)
    expect(store.rows).toHaveLength(2)
  })

  test('DB completion outage leaves a lease to reclaim and retries the exact idempotency key', async () => {
    const { bridge, store, deliver } = fixture()
    await bridge.enqueue(event())
    const update = store.db.pluginEventDelivery.updateMany.getMockImplementation()
    store.db.pluginEventDelivery.updateMany.mockImplementation(async (args: any) => {
      if (args.data.state !== 'DELIVERING') throw new Error('completion database down')
      return update(args)
    })
    await expect(bridge.processPending()).rejects.toThrow('ERR_PLUGIN_EVENT_OUTBOX_UNAVAILABLE')
    expect(store.rows[0]).toMatchObject({ state: 'DELIVERING', attempts: 1 })
    expect(await bridge.backlog('db-demo')).toEqual({ pending: 1, failed: 0, deadLetter: 0 })
    expect(await bridge.backlog('other')).toEqual({ pending: 0, failed: 0, deadLetter: 0 })
    store.db.pluginEventDelivery.updateMany.mockImplementation(update)
    jest.setSystemTime(Date.now() + 60001)
    await bridge.processPending()
    expect(deliver).toHaveBeenCalledTimes(2)
    expect(deliver.mock.calls[0]).toEqual(deliver.mock.calls[1])
    expect(store.rows[0]).toMatchObject({ state: 'DELIVERED', attempts: 2 })
  })

  test('malformed stream entry stays unacked without blocking the next valid entry', async () => {
    const stream = new MockStream()
    stream.fresh.push(['bad-0', ['payload', '{bad JSON']], message())
    const { bridge, store } = fixture(database(), stream)
    bridge.start()
    await flush()
    expect(stream.pending.has('bad-0')).toBe(true)
    expect(stream.pending.has('1-0')).toBe(false)
    expect(store.rows).toHaveLength(1)
    await bridge.stop()
  })

  test('core publisher failure after acceptance cannot discard the durable outbox', async () => {
    const { bridge, store, bus, deliver } = fixture()
    bus.publish = jest.fn(async () => { throw new Error('core Redis disconnected') })
    bridge.start()
    await flush()
    await expect(bus.publish(event())).rejects.toThrow('core Redis disconnected')
    expect(store.rows).toHaveLength(1)
    await bridge.processPending()
    expect(deliver).toHaveBeenCalledTimes(1)
    await bridge.stop()
  })

})

import Redis from 'ioredis'
import { randomUUID } from 'node:crypto'
import type { IDomainEvent, IEventBus } from '../../domain/shared/events/IEventBus'
import { getEventBus } from '../events/EventBusFactory'
import { prisma } from '../../db'
import type { Prisma as PrismaTypes } from '../../generated/prisma/client'
import type { PluginEventEnvelope } from './PluginContracts'
import type { PluginControlPort } from './PluginControlPort'
import { pluginControlClient } from './PluginControlPort'
import { createPluginEventEnvelope, getPluginEventDefinition } from './PluginEventCatalog'
import { validatePluginManifest } from './PluginManifest'

// A lease exceeds the control HTTP timeout. attempts is the fencing generation;
// every completion must still own that generation and the exact lease timestamp.
const LEASE_MS = 60000
const DELIVERY_TIMEOUT_MS = 15000
const MAX_ATTEMPTS = 10
const BATCH_SIZE = 25
const STREAM_KEY = 'myndbbs:events'
const CONSUMER_GROUP = 'myndbbs-plugin-bridge'

type StreamMessage = [string, string[]]
type RedisStreamResult = [string, StreamMessage[]][]
type BridgeDatabase = Pick<typeof prisma, 'plugin' | 'pluginEventDelivery' | '$transaction'>
type EligiblePlugin = {
  desiredState: string
  runtimeState: string
  currentVersion: string | null
  releases: { version: string; manifest: unknown }[]
}

function isEligible(plugin: EligiblePlugin | null, eventName: string, version: number): boolean {
  if (!plugin || plugin.desiredState !== 'ACTIVE' || !['ACTIVE', 'ROLLED_BACK', 'UNHEALTHY'].includes(plugin.runtimeState)) return false
  const definition = getPluginEventDefinition(eventName)
  if (!definition || definition.version !== version) return false
  const release = plugin.releases.find((item) => item.version === plugin.currentVersion)
  if (!release) return false
  try {
    validatePluginManifest(release.manifest)
    return release.manifest.capabilities.events.some((item) => item.name === eventName && item.version === version)
  } catch { return false }
}

const activeReleases = { releases: { where: { state: 'ACTIVE' as const } } }

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => { const timer = setTimeout(resolve, ms); timer.unref() })
}

function redisFields(fields: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (let index = 0; index + 1 < fields.length; index += 2) result[fields[index]!] = fields[index + 1]!
  return result
}

function rehydrateEvent(value: Record<string, unknown>): IDomainEvent {
  return { ...value, occurredOn: new Date(String(value.occurredOn)) } as unknown as IDomainEvent
}

export class PluginEventBridge {
  private timer: NodeJS.Timeout | undefined
  private started = false
  private shouldStop = false
  private redis: Redis | undefined
  private consumerTask: Promise<void> | undefined
  private pendingTask: Promise<void> | undefined
  private originalPublish: IEventBus['publish'] | undefined
  private durablePublish: IEventBus['publish'] | undefined
  private readonly consumerName = `plugin-bridge-${process.pid}-${randomUUID()}`

  public constructor(
    private readonly eventBus: IEventBus,
    private readonly control: PluginControlPort = pluginControlClient(),
    private readonly database: BridgeDatabase = prisma,
    private readonly redisFactory: () => Redis | undefined = () => process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, { enableOfflineQueue: false, maxRetriesPerRequest: 1 })
      : undefined,
  ) {}

  public start(): void {
    if (this.started) return
    this.started = true
    this.shouldStop = false
    // Subscribers are deliberately NOT used as an outbox: core buses swallow their
    // errors. Persist before calling the core publisher (also when Redis is offline).
    // This awaits only DB acceptance, never plugin execution or a delivery retry.
    this.originalPublish = this.eventBus.publish
    const originalPublish = this.originalPublish
    this.durablePublish = async (event) => {
      await this.enqueue(event)
      await originalPublish.call(this.eventBus, event)
    }
    this.eventBus.publish = this.durablePublish
    this.timer = setInterval(() => { this.schedulePending() }, 1000)
    this.timer.unref()
    this.redis = this.redisFactory()
    if (this.redis) {
      this.redis.on('error', () => console.error('[PluginEventBridge] Redis unavailable; DB outbox retained'))
      this.consumerTask = this.consumeRedisStream(this.redis)
    }
    this.schedulePending()
  }

  public async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
    this.shouldStop = true
    const redis = this.redis
    this.redis = undefined
    // Disconnect interrupts BLOCK immediately; failed ACKs remain pending for reclaim.
    redis?.disconnect()
    await Promise.allSettled([this.consumerTask, this.pendingTask])
    if (this.eventBus.publish === this.durablePublish && this.originalPublish) {
      this.eventBus.publish = this.originalPublish
    }
    this.started = false
  }

  private schedulePending(): void {
    void this.processPending().catch(() => console.error('[PluginEventBridge] Outbox processing failed; will retry'))
  }

  public processPending(): Promise<void> {
    if (this.pendingTask) return this.pendingTask
    const task = this.deliverPending().finally(() => {
      if (this.pendingTask === task) this.pendingTask = undefined
    })
    this.pendingTask = task
    return task
  }

  private async deliverPending(): Promise<void> {
    const now = new Date()
    const due = {
      state: { in: ['PENDING', 'FAILED', 'DELIVERING'] as ('PENDING' | 'FAILED' | 'DELIVERING')[] },
      availableAt: { lte: now },
    }
    const rows = await this.database.pluginEventDelivery.findMany({
      where: due, orderBy: { availableAt: 'asc' }, take: BATCH_SIZE,
    })
    // One unavailable plugin does not serialize the rest of the batch.
    const results = await Promise.allSettled(rows.map(async (row) => {
      if (this.shouldStop) return
      const lastAttemptAt = new Date()
      const leaseUntil = new Date(lastAttemptAt.getTime() + LEASE_MS)
      const claimed = await this.database.pluginEventDelivery.updateMany({
        where: { id: row.id, attempts: row.attempts, ...due },
        data: { state: 'DELIVERING', attempts: { increment: 1 }, lastAttemptAt, availableAt: leaseUntil },
      })
      if (claimed.count !== 1) return
      const owned = { id: row.id, state: 'DELIVERING' as const, attempts: row.attempts + 1, availableAt: leaseUntil }
      const terminal = async (code: string): Promise<void> => {
        await this.database.pluginEventDelivery.updateMany({
          where: owned, data: { state: 'DEAD_LETTER', lastError: code },
        })
      }
      if (row.attempts >= MAX_ATTEMPTS) {
        await terminal('ERR_PLUGIN_EVENT_ATTEMPTS_EXHAUSTED')
        return
      }
      try {
        // Re-read after claiming: the enqueue-time manifest is not authorization.
        const plugin = await this.database.plugin.findUnique({ where: { id: row.pluginId }, include: activeReleases })
        if (!plugin || !isEligible(plugin, row.eventName, row.schemaVersion)) {
          await terminal('ERR_PLUGIN_EVENT_CAPABILITY_REVOKED')
          return
        }
        const stored = row.payload as Record<string, unknown>
        const definition = getPluginEventDefinition(row.eventName)!
        const occurredAt = String(stored.occurredAt ?? row.createdAt.toISOString())
        const source = stored.payload && typeof stored.payload === 'object' ? stored.payload : {}
        const event: PluginEventEnvelope = {
          eventId: row.eventId, eventName: row.eventName, schemaVersion: row.schemaVersion,
          occurredAt, idempotencyKey: `${row.eventName}:${row.eventId}`,
          // Re-sanitize old persisted rows too; never send a historical raw payload.
          payload: definition.toPayload({ ...source, eventName: row.eventName, occurredOn: new Date(occurredAt) }),
        }
        await this.deliverWithTimeout(plugin.pluginId, event)
        await this.database.pluginEventDelivery.updateMany({
          where: owned, data: { state: 'DELIVERED', deliveredAt: new Date(), lastError: null },
        })
      } catch {
        // No untrusted plugin error text: it may contain credentials or private content.
        const attempts = row.attempts + 1
        await this.database.pluginEventDelivery.updateMany({
          where: owned,
          data: {
            state: attempts >= MAX_ATTEMPTS ? 'DEAD_LETTER' : 'FAILED',
            lastError: 'ERR_PLUGIN_EVENT_DELIVERY_FAILED',
            availableAt: new Date(Date.now() + Math.min(300000, 1000 * 2 ** Math.min(attempts, 9))),
          },
        })
      }
    }))
    if (results.some((result) => result.status === 'rejected')) throw new Error('ERR_PLUGIN_EVENT_OUTBOX_UNAVAILABLE')
  }

  private async deliverWithTimeout(pluginId: string, event: PluginEventEnvelope): Promise<void> {
    let timer: NodeJS.Timeout | undefined
    try {
      await Promise.race([
        this.control.deliverEvent(pluginId, event),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('ERR_PLUGIN_EVENT_TIMEOUT')), DELIVERY_TIMEOUT_MS)
          timer.unref()
        }),
      ])
    } finally { if (timer) clearTimeout(timer) }
  }

  public async backlog(pluginId?: string): Promise<{ pending: number; failed: number; deadLetter: number }> {
    const where = pluginId ? { plugin: { pluginId } } : {}
    const [pending, failed, deadLetter] = await Promise.all([
      this.database.pluginEventDelivery.count({ where: { ...where, state: { in: ['PENDING', 'DELIVERING'] } } }),
      this.database.pluginEventDelivery.count({ where: { ...where, state: 'FAILED' } }),
      this.database.pluginEventDelivery.count({ where: { ...where, state: 'DEAD_LETTER' } }),
    ])
    return { pending, failed, deadLetter }
  }

  private async consumeRedisStream(redis: Redis): Promise<void> {
    let initialized = false
    let cursor = '0-0'
    while (!this.shouldStop && this.redis === redis) {
      try {
        if (!initialized) {
          try { await redis.xgroup('CREATE', STREAM_KEY, CONSUMER_GROUP, '0', 'MKSTREAM') }
          catch (error) { if (!String(error).includes('BUSYGROUP')) throw error }
          initialized = true
        }
        // Scan the PEL cursor on every pass, including when no new messages arrive.
        const claimed = await redis.call('XAUTOCLAIM', STREAM_KEY, CONSUMER_GROUP, this.consumerName,
          LEASE_MS, cursor, 'COUNT', BATCH_SIZE) as [string, StreamMessage[], string[]?]
        cursor = claimed[0]
        await this.acceptStreamMessages(redis, claimed[1])
        if (claimed[2]?.length) console.error('[PluginEventBridge] Core stream trimmed pending entries:', claimed[2].length)
        const result = await redis.xreadgroup('GROUP', CONSUMER_GROUP, this.consumerName,
          'COUNT', BATCH_SIZE, 'BLOCK', 1000, 'STREAMS', STREAM_KEY, '>') as RedisStreamResult | null
        for (const [, messages] of result ?? []) await this.acceptStreamMessages(redis, messages)
      } catch {
        // Reconnect, a lost group, ACK failure and DB failure must not kill the consumer.
        initialized = false
        if (!this.shouldStop) {
          console.error('[PluginEventBridge] Stream cycle failed; unacked events retained')
          await pause(1000)
        }
      }
    }
  }

  private async acceptStreamMessages(redis: Redis, messages: StreamMessage[]): Promise<void> {
    for (const [id, fields] of messages) {
      if (this.shouldStop) return
      try {
        const payload = redisFields(fields).payload
        if (!payload) throw new Error('ERR_PLUGIN_EVENT_MISSING_PAYLOAD')
        const parsed: unknown = JSON.parse(payload)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('ERR_PLUGIN_EVENT_INVALID_PAYLOAD')
        const event = rehydrateEvent(parsed as Record<string, unknown>)
        if (typeof event.eventName !== 'string') throw new Error('ERR_PLUGIN_EVENT_INVALID_NAME')
        await this.enqueue(event)
        // Only acknowledge after ALL intended deliveries have committed atomically.
        await redis.xack(STREAM_KEY, CONSUMER_GROUP, id)
      } catch {
        console.error('[PluginEventBridge] Stream event retained for retry:', id)
      }
    }
  }

  public async enqueue(event: IDomainEvent): Promise<void> {
    const envelope = createPluginEventEnvelope(event)
    if (!envelope) return
    await this.database.$transaction(async (tx) => {
      const plugins = await tx.plugin.findMany({
        where: { desiredState: 'ACTIVE', runtimeState: { in: ['ACTIVE', 'ROLLED_BACK', 'UNHEALTHY'] }, currentVersion: { not: null } },
        include: activeReleases,
      })
      for (const plugin of plugins) {
        if (!isEligible(plugin, envelope.eventName, envelope.schemaVersion)) continue
        const payload = { occurredAt: envelope.occurredAt, idempotencyKey: envelope.idempotencyKey, payload: envelope.payload }
        await tx.pluginEventDelivery.upsert({
          where: { pluginId_eventId: { pluginId: plugin.id, eventId: envelope.eventId } },
          create: { pluginId: plugin.id, eventId: envelope.eventId, eventName: envelope.eventName,
            schemaVersion: envelope.schemaVersion, payload: payload as PrismaTypes.InputJsonValue, state: 'PENDING' },
          update: {},
        })
      }
    })
  }

}

export const pluginEventBridge = new PluginEventBridge(getEventBus())

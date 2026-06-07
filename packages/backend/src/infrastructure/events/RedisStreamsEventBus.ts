import { IEventBus, IDomainEvent } from '../../domain/shared/events/IEventBus';
import Redis from 'ioredis';

const STREAM_KEY = 'myndbbs:events';
const CONSUMER_GROUP = 'myndbbs-workers';

export class RedisStreamsEventBus implements IEventBus {
  private publisher: Redis | null = null;
  private consumer: Redis | null = null;
  private localHandlers = new Map<string, Array<(event: IDomainEvent) => Promise<void> | void>>();
  private consumerStarted = false;
  private shouldStop = false;

  constructor() {
    if (process.env.REDIS_URL) {
      this.publisher = new Redis(process.env.REDIS_URL);
      this.consumer = new Redis(process.env.REDIS_URL);
      this.ensureConsumerGroup().catch((err: unknown) => {
        console.error('[RedisStreamsEventBus] Failed to ensure consumer group:', err);
      });
    }
  }

  async publish(event: IDomainEvent): Promise<void> {
    if (this.publisher) {
      try {
        await this.publisher.xadd(
          STREAM_KEY,
          '*',
          'eventName',
          event.eventName,
          'payload',
          JSON.stringify(event),
          'occurredOn',
          event.occurredOn.toISOString(),
          'source',
          `instance-${process.pid}`,
          'traceId',
          '',
        );
        await this.publisher.xtrim(STREAM_KEY, 'MAXLEN', '~', 10000);
        await this.publishLocal(event);
      } catch (err) {
        console.error('[RedisStreamsEventBus] xadd failed, falling back to local:', err);
        await this.publishLocal(event);
      }
    } else {
      await this.publishLocal(event);
    }
  }

  subscribe<T extends IDomainEvent>(eventName: string, handler: (event: T) => Promise<void> | void): void {
    if (!this.localHandlers.has(eventName)) {
      this.localHandlers.set(eventName, []);
    }
    this.localHandlers.get(eventName)!.push(handler as (event: IDomainEvent) => Promise<void> | void);
  }

  private async publishLocal(event: IDomainEvent): Promise<void> {
    const handlers = this.localHandlers.get(event.eventName);
    if (handlers) {
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (err) {
          console.error(`[RedisStreamsEventBus] Error handling event ${event.eventName}:`, err);
        }
      }
    }
  }

  private async ensureConsumerGroup(): Promise<void> {
    if (!this.consumer) return;
    try {
      await this.consumer.xgroup('CREATE', STREAM_KEY, CONSUMER_GROUP, '0', 'MKSTREAM');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('BUSYGROUP')) {
        throw err;
      }
    }
  }

  async startConsumer(consumerName: string = `instance-${process.pid}`): Promise<void> {
    if (!this.consumer || this.consumerStarted) return;
    this.consumerStarted = true;
    this.shouldStop = false;
    await this.ensureConsumerGroup();

    while (!this.shouldStop) {
      try {
        const results = await this.consumer.xreadgroup(
          'GROUP',
          CONSUMER_GROUP,
          consumerName,
          'COUNT',
          10,
          'BLOCK',
          5000,
          'STREAMS',
          STREAM_KEY,
          '>',
        );

        if (results) {
          for (const result of results) {
            const messages = (result as [string, [string, string[]][]])[1];
            for (const msg of messages) {
              const id = msg[0];
              const fields = msg[1];
              const fieldMap = this.parseFields(fields);
              const payload = fieldMap.payload;

              try {
                if (payload) {
                  const event = this.rehydrateEvent(JSON.parse(payload) as Record<string, unknown>);
                  await this.publishLocal(event);
                }
              } catch (parseErr) {
                console.error(`[RedisStreamsEventBus] Failed to parse event ${id}:`, parseErr);
              }

              await this.consumer!.xack(STREAM_KEY, CONSUMER_GROUP, id);
            }
          }
        }
      } catch (err) {
        console.error('[RedisStreamsEventBus] Consumer error:', err);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    this.consumerStarted = false;
  }

  async getHealthInfo(): Promise<Record<string, unknown>> {
    if (!this.consumer) return { status: 'no-redis' };
    try {
      const info = await this.consumer.xinfo('GROUPS', STREAM_KEY);
      return { status: 'ok', groups: info };
    } catch {
      return { status: 'error', streamNotFound: true };
    }
  }

  async shutdown(): Promise<void> {
    this.shouldStop = true;
    if (this.publisher) {
      await this.publisher.quit();
      this.publisher = null;
    }
    if (this.consumer) {
      await this.consumer.quit();
      this.consumer = null;
    }
  }

  private parseFields(fields: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (let index = 0; index + 1 < fields.length; index += 2) {
      result[fields[index]!] = fields[index + 1]!;
    }
    return result;
  }

  private rehydrateEvent(event: Record<string, unknown>): IDomainEvent {
    const occurredOn = event.occurredOn instanceof Date
      ? event.occurredOn
      : new Date(String(event.occurredOn ?? Date.now()));
    return { ...event, occurredOn } as unknown as IDomainEvent;
  }
}

export const redisStreamsEventBus = new RedisStreamsEventBus();

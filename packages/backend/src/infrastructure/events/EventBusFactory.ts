import { IEventBus, IDomainEvent } from '../../domain/shared/events/IEventBus';
import { InMemoryEventBus } from './InMemoryEventBus';
import { RedisStreamsEventBus } from './RedisStreamsEventBus';

let eventBusInstance: IEventBus | null = null;

export function createEventBus(): IEventBus {
  if (eventBusInstance) return eventBusInstance;

  if (process.env.REDIS_URL) {
    eventBusInstance = new RedisStreamsEventBus();
  } else {
    eventBusInstance = new InMemoryEventBus();
  }

  return eventBusInstance;
}

export function getEventBus(): IEventBus {
  return eventBusInstance ?? createEventBus();
}

export { InMemoryEventBus, RedisStreamsEventBus };

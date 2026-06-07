import { IEventBus, IDomainEvent } from '../../domain/shared/events/IEventBus';

/**
 * Callers: [Server initialization, Application Services]
 * Callees: [EventEmitter.emit, EventEmitter.on]
 * Description: An in-memory implementation of the Event Bus using Node.js EventEmitter. Designed to decouple bounded contexts.
 * Keywords: event, bus, in-memory, emitter, publish, subscribe, infrastructure
 */
export class InMemoryEventBus implements IEventBus {
  private handlers = new Map<string, Array<(event: IDomainEvent) => Promise<void> | void>>();

  /**
   * Callers: [Server initialization]
   * Callees: [EventEmitter.constructor]
   * Description: Initializes the underlying EventEmitter.
   * Keywords: constructor, event, bus, instantiation
   */
  constructor() {
  }

  /**
   * Callers: [Controllers, Domain Services]
   * Callees: [EventEmitter.emit]
   * Description: Publishes a domain event to all registered listeners synchronously (or asynchronously depending on handlers).
   * Keywords: publish, emit, event, bus, broadcast
   */
  public async publish(event: IDomainEvent): Promise<void> {
    // console.log(`[EventBus] Publishing event: ${event.eventName}`);
    const handlers = this.handlers.get(event.eventName) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`[EventBus] Error handling event ${event.eventName}:`, error);
      }
    }
  }

  /**
   * Callers: [Application Services (e.g., NotificationApplicationService)]
   * Callees: [EventEmitter.on]
   * Description: Registers an asynchronous handler for a specific domain event. Includes top-level error catching to prevent unhandled promise rejections from crashing the process.
   * Keywords: subscribe, register, handler, event, bus, on
   */
  public subscribe<T extends IDomainEvent>(eventName: string, handler: (event: T) => Promise<void> | void): void {
    const handlers = this.handlers.get(eventName) ?? [];
    handlers.push(handler as (event: IDomainEvent) => Promise<void> | void);
    this.handlers.set(eventName, handlers);
  }
}

// Global Singleton Instance
export const globalEventBus = new InMemoryEventBus();

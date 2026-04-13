import { EventEmitter } from 'events';
import { IEventBus, IDomainEvent } from '../../domain/shared/events/IEventBus';

/**
 * Callers: [Server initialization, Application Services]
 * Callees: [EventEmitter.emit, EventEmitter.on]
 * Description: An in-memory implementation of the Event Bus using Node.js EventEmitter. Designed to decouple bounded contexts.
 * Keywords: event, bus, in-memory, emitter, publish, subscribe, infrastructure
 */
export class InMemoryEventBus implements IEventBus {
  private emitter: EventEmitter;

  /**
   * Callers: [Server initialization]
   * Callees: [EventEmitter.constructor]
   * Description: Initializes the underlying EventEmitter.
   * Keywords: constructor, event, bus, instantiation
   */
  constructor() {
    this.emitter = new EventEmitter();
  }

  /**
   * Callers: [Controllers, Domain Services]
   * Callees: [EventEmitter.emit]
   * Description: Publishes a domain event to all registered listeners synchronously (or asynchronously depending on handlers).
   * Keywords: publish, emit, event, bus, broadcast
   */
  public publish(event: IDomainEvent): void {
    // console.log(`[EventBus] Publishing event: ${event.eventName}`);
    this.emitter.emit(event.eventName, event);
  }

  /**
   * Callers: [Application Services (e.g., NotificationApplicationService)]
   * Callees: [EventEmitter.on]
   * Description: Registers an asynchronous handler for a specific domain event. Includes top-level error catching to prevent unhandled promise rejections from crashing the process.
   * Keywords: subscribe, register, handler, event, bus, on
   */
  public subscribe<T extends IDomainEvent>(eventName: string, handler: (event: T) => Promise<void> | void): void {
    this.emitter.on(eventName, async (event: T) => {
      try {
        await handler(event);
      } catch (error) {
        console.error(`[EventBus] Error handling event ${eventName}:`, error);
      }
    });
  }
}

// Global Singleton Instance
export const globalEventBus = new InMemoryEventBus();

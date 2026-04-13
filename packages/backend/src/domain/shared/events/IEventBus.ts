/**
 * Callers: [IEventBus, Specific Domain Events]
 * Callees: []
 * Description: The base interface for all Domain Events in the system.
 * Keywords: domain, event, interface, contract, shared
 */
export interface IDomainEvent {
  eventName: string;
  occurredOn: Date;
}

/**
 * Callers: [NotificationApplicationService, Controllers]
 * Callees: [IDomainEvent]
 * Description: The contract for the Event Bus, allowing publishing and subscribing to Domain Events.
 * Keywords: event, bus, publish, subscribe, contract, shared
 */
export interface IEventBus {
  /**
   * Callers: [Controllers, Application Services]
   * Callees: []
   * Description: Publishes a Domain Event to all registered subscribers.
   * Keywords: publish, event, bus, broadcast
   */
  publish(event: IDomainEvent): void;

  /**
   * Callers: [NotificationApplicationService]
   * Callees: []
   * Description: Registers a handler function for a specific type of Domain Event.
   * Keywords: subscribe, register, handler, event, bus
   */
  subscribe<T extends IDomainEvent>(eventName: string, handler: (event: T) => Promise<void> | void): void;
}

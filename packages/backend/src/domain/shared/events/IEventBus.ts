/**
 * 接口名称：IDomainEvent
 *
 * 函数作用：
 *   领域事件的基础接口——系统中有且所有的领域事件都必须实现的契约。
 * Purpose:
 *   Base interface for all Domain Events in the system.
 *
 * 中文关键词：
 *   领域事件，接口，事件名称，发生时间
 * English keywords:
 *   domain event, interface, event name, occurred on
 */
export interface IDomainEvent {
  eventName: string;
  occurredOn: Date;
}

/**
 * 接口名称：IEventBus
 *
 * 函数作用：
 *   事件总线接口——定义发布和订阅领域事件的契约。
 * Purpose:
 *   Event Bus interface — defines the contract for publishing and subscribing to Domain Events.
 *
 * 中文关键词：
 *   事件总线，发布，订阅
 * English keywords:
 *   event bus, publish, subscribe
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

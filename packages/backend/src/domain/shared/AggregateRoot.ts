import { IDomainEvent } from './events/IEventBus';

export abstract class AggregateRoot {
  private _domainEvents: IDomainEvent[] = [];

  public get domainEvents(): IDomainEvent[] {
    return this._domainEvents;
  }

  protected addDomainEvent(domainEvent: IDomainEvent): void {
    this._domainEvents.push(domainEvent);
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }
}

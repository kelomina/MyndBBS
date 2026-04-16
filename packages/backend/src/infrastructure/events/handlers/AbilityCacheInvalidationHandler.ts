import { IEventBus } from '../../../domain/shared/events/IEventBus';
import { IAbilityCache } from '../../../domain/identity/IAbilityCache';
import { CategoryModeratorAssignedEvent, CategoryModeratorRemovedEvent } from '../../../domain/shared/events/DomainEvents';

export class AbilityCacheInvalidationHandler {
  constructor(
    private readonly eventBus: IEventBus,
    private readonly abilityCache: IAbilityCache
  ) {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.eventBus.subscribe<CategoryModeratorAssignedEvent>('CategoryModeratorAssignedEvent', async (event) => {
      await this.abilityCache.invalidateUserRules(event.userId);
    });

    this.eventBus.subscribe<CategoryModeratorRemovedEvent>('CategoryModeratorRemovedEvent', async (event) => {
      await this.abilityCache.invalidateUserRules(event.userId);
    });
  }
}

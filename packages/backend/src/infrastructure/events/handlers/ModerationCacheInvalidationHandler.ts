import { IEventBus } from '../../../domain/shared/events/IEventBus';
import { IModerationPolicy } from '../../../domain/community/IModerationPolicy';
import { ModeratedWordAddedEvent, ModeratedWordDeletedEvent } from '../../../domain/shared/events/DomainEvents';

export class ModerationCacheInvalidationHandler {
  constructor(
    private readonly eventBus: IEventBus,
    private readonly moderationPolicy: IModerationPolicy
  ) {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.eventBus.subscribe<ModeratedWordAddedEvent>('ModeratedWordAddedEvent', async () => {
      await this.moderationPolicy.clearCache();
    });

    this.eventBus.subscribe<ModeratedWordDeletedEvent>('ModeratedWordDeletedEvent', async () => {
      await this.moderationPolicy.clearCache();
    });
  }
}

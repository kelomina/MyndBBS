/**
 * 类名称：ModerationCacheInvalidationHandler
 *
 * 函数作用：
 *   审核缓存失效事件处理器——订阅敏感词新增/删除事件，自动清除缓存。
 * Purpose:
 *   Moderation cache invalidation handler — subscribes to moderated word add/delete events and clears the cache.
 *
 * 中文关键词：
 *   审核缓存，失效，事件处理，敏感词
 * English keywords:
 *   moderation cache, invalidation, event handler, moderated word
 */
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

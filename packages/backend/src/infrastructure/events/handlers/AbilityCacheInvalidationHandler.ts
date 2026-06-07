/**
 * 类名称：AbilityCacheInvalidationHandler
 *
 * 函数作用：
 *   权限缓存失效事件处理器——订阅分类版主分配/移除事件，自动失效相关用户的权限缓存。
 * Purpose:
 *   Ability cache invalidation handler — subscribes to category moderator assign/remove events
 *   and automatically invalidates affected users' ability caches.
 *
 * 中文关键词：
 *   权限缓存，失效，事件处理，版主
 * English keywords:
 *   ability cache, invalidation, event handler, moderator
 */
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

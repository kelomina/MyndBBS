/**
 * 事件侦听器：BadgeEventListener
 *
 * 函数作用：
 *   订阅与徽章授予相关的领域事件：
 *   - UserPromotedEvent：用户等级被管理员调整后，立即重新评估该用户的
 *     自动徽章（让 level 徽章即时到账，无需等待周期任务）。
 *
 * Purpose:
 *   Subscribes to user level change events and re-evaluates auto badges
 *   for the affected user immediately.
 */
import { IEventBus } from '../../../domain/shared/events/IEventBus';
import { UserPromotedEvent } from '../../../domain/shared/events/DomainEvents';
import { BadgeApplicationService } from '../../../application/badge/BadgeApplicationService';

export class BadgeEventListener {
  constructor(
    private eventBus: IEventBus,
    private badgeApplicationService: BadgeApplicationService,
  ) {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.eventBus.subscribe<UserPromotedEvent>('UserPromotedEvent', async (event) => {
      try {
        await this.badgeApplicationService.evaluateUser(event.targetUserId);
      } catch (err) {
        console.error('[BadgeEventListener] Failed to evaluate badges after level change:', err);
      }
    });
  }
}

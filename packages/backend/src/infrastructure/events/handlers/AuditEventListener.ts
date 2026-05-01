import { IEventBus } from '../../../domain/shared/events/IEventBus';
import { AuditApplicationService } from '../../../application/system/AuditApplicationService';
import {
  CategoryCreatedEvent,
  CategoryUpdatedEvent,
  CategoryDeletedEvent,
  CategoryModeratorAssignedEvent,
  CategoryModeratorRemovedEvent,
  UserPromotedEvent,
  UserStatusChangedEvent,
  UserRoleChangedEvent,
  DbConfigUpdatedEvent
} from '../../../domain/shared/events/DomainEvents';

/**
 * 类名称：AuditEventListener
 *
 * 函数作用：
 *   审计事件侦听器——订阅各类领域事件，通过 AuditApplicationService 记录审计日志。
 * Purpose:
 *   Audit event listener — subscribes to domain events and records audit logs via AuditApplicationService.
 *
 * 订阅的事件 / Subscribed events:
 *   - CategoryCreatedEvent / CategoryUpdatedEvent / CategoryDeletedEvent
 *   - CategoryModeratorAssignedEvent / CategoryModeratorRemovedEvent
 *   - UserPromotedEvent / UserStatusChangedEvent / UserRoleChangedEvent
 *   - DbConfigUpdatedEvent
 *
 * 中文关键词：
 *   审计，事件侦听器，领域事件
 * English keywords:
 *   audit, event listener, domain events
 */
export class AuditEventListener {
  constructor(
    private eventBus: IEventBus,
    private auditApplicationService: AuditApplicationService
  ) {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.eventBus.subscribe<CategoryCreatedEvent>('CategoryCreatedEvent', async (event) => {
      await this.auditApplicationService.logAudit(event.operatorId, 'CREATE_CATEGORY', `Category:${event.categoryId}`);
    });

    this.eventBus.subscribe<CategoryUpdatedEvent>('CategoryUpdatedEvent', async (event) => {
      await this.auditApplicationService.logAudit(event.operatorId, 'UPDATE_CATEGORY', `Category:${event.categoryId}`);
    });

    this.eventBus.subscribe<CategoryDeletedEvent>('CategoryDeletedEvent', async (event) => {
      await this.auditApplicationService.logAudit(event.operatorId, 'DELETE_CATEGORY', `Category:${event.categoryId}`);
    });

    this.eventBus.subscribe<CategoryModeratorAssignedEvent>('CategoryModeratorAssignedEvent', async (event) => {
      await this.auditApplicationService.logAudit(event.operatorId, 'ASSIGN_CATEGORY_MODERATOR', `User:${event.userId} to Category:${event.categoryId}`);
    });

    this.eventBus.subscribe<CategoryModeratorRemovedEvent>('CategoryModeratorRemovedEvent', async (event) => {
      await this.auditApplicationService.logAudit(event.operatorId, 'REMOVE_CATEGORY_MODERATOR', `User:${event.userId} from Category:${event.categoryId}`);
    });

    this.eventBus.subscribe<UserPromotedEvent>('UserPromotedEvent', async (event) => {
      await this.auditApplicationService.logAudit(event.operatorId, 'UPDATE_USER_LEVEL', `User:${event.targetUserId} to Level ${event.newLevel}`);
    });

    this.eventBus.subscribe<UserStatusChangedEvent>('UserStatusChangedEvent', async (event) => {
      await this.auditApplicationService.logAudit(event.operatorId, 'UPDATE_USER_STATUS', `User:${event.targetUserId} to ${event.newStatus}`);
    });

    this.eventBus.subscribe<UserRoleChangedEvent>('UserRoleChangedEvent', async (event) => {
      await this.auditApplicationService.logAudit(event.operatorId, 'UPDATE_USER_ROLE', `User:${event.targetUserId} to ${event.newRole}`);
    });

    this.eventBus.subscribe<DbConfigUpdatedEvent>('DbConfigUpdatedEvent', async (event) => {
      await this.auditApplicationService.logAudit(event.operatorId, 'UPDATE_DB_CONFIG', 'PostgreSQL config updated in .env');
    });
  }
}

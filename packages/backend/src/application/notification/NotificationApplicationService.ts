import { INotificationRepository } from '../../domain/notification/INotificationRepository';
import { Notification } from '../../domain/notification/Notification';
import { IEventBus } from '../../domain/shared/events/IEventBus';
import { PostApprovedEvent, PostRejectedEvent, PostRepliedEvent, CommentRepliedEvent } from '../../domain/shared/events/DomainEvents';
import { randomUUID as uuidv4 } from 'crypto';
import { IModeratorReadModel } from './ports/IModeratorReadModel';

/**
 * Callers: [Server initialization, Controllers]
 * Callees: [INotificationRepository.save, Notification.create, Notification.markAsRead, IEventBus.subscribe]
 * Description: The Application Service for the Notification Domain. It subscribes to global domain events to generate notifications and handles read/unread use cases.
 * Keywords: notification, service, application, orchestration, event, bus, subscriber, handler
 */
export class NotificationApplicationService {
  /**
   * Callers: [Server initialization]
   * Callees: [registerEventHandlers]
   * Description: Initializes the service with the repository and event bus, and automatically registers all event handlers.
   * Keywords: constructor, inject, repository, service, notification, event, bus
   */
  constructor(
    private notificationRepository: INotificationRepository,
    private eventBus: IEventBus,
    private moderatorReadModel: IModeratorReadModel
  ) {
    this.registerEventHandlers();
  }

  // --- Use Cases ---

  /**
   * Callers: [NotificationController]
   * Callees: [INotificationRepository.findById, Notification.markAsRead, INotificationRepository.save]
   * Description: Marks a specific notification as read.
   * Keywords: mark, read, notification, command, service
   */
  public async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationRepository.findById(notificationId);
    if (!notification) {
      throw new Error('ERR_NOTIFICATION_NOT_FOUND');
    }
    if (notification.userId !== userId) {
      throw new Error('ERR_FORBIDDEN_NOT_YOUR_NOTIFICATION');
    }
    notification.markAsRead();
    await this.notificationRepository.save(notification);
  }

  // --- Internal Methods (Event Handlers) ---

  /**
   * Callers: [NotificationApplicationService.constructor]
   * Callees: [IEventBus.subscribe, createNotification]
   * Description: Registers asynchronous handlers for cross-domain events that require generating a notification.
   * Keywords: register, handlers, event, bus, subscribe, integration
   */
  private registerEventHandlers(): void {
    this.eventBus.subscribe<PostApprovedEvent>('PostApprovedEvent', async (event) => {
      await this.createNotification(
        event.authorId,
        'POST_APPROVED',
        'Post Approved',
        `Your post "${event.postTitle}" has been approved by a moderator.`,
        event.postId
      );
    });

    this.eventBus.subscribe<PostRejectedEvent>('PostRejectedEvent', async (event) => {
      await this.createNotification(
        event.authorId,
        'POST_REJECTED',
        'Post Rejected',
        `Your post "${event.postTitle}" was rejected. Reason: ${event.reason}`,
        event.postId
      );
    });

    this.eventBus.subscribe<PostRepliedEvent>('PostRepliedEvent', async (event) => {
      if (event.authorId === event.replierId) return; // Don't notify self
      await this.createNotification(
        event.authorId,
        'POST_REPLIED',
        'New Reply to Your Post',
        `Someone replied to your post "${event.postTitle}".`,
        event.postId
      );
    });

    this.eventBus.subscribe<CommentRepliedEvent>('CommentRepliedEvent', async (event) => {
      if (event.authorId === event.replierId) return; // Don't notify self
      await this.createNotification(
        event.authorId,
        'COMMENT_REPLIED',
        'New Reply to Your Comment',
        `Someone replied to your comment on a post.`,
        event.postId
      );
    });

    // Special handler for generic SYSTEM notifications directed at moderators
    // Emulates the old `notifyModerators` behavior using a generic event
    this.eventBus.subscribe<any>('SystemAlertEvent', async (event) => {
      if (!event.title || !event.content) return;
      const moderators = await this.moderatorReadModel.listUserIdsByLevel(3);
      for (const mod of moderators) {
        await this.createNotification(mod.id, 'SYSTEM', event.title, event.content, null);
      }
    });
  }

  /**
   * Callers: [Event Handlers]
   * Callees: [Notification.create, INotificationRepository.save]
   * Description: Helper method to instantiate and persist a Notification aggregate.
   * Keywords: create, persist, helper, notification, aggregate
   */
  private async createNotification(userId: string, type: string, title: string, content: string, relatedId: string | null): Promise<void> {
    const notification = Notification.create({
      id: uuidv4(),
      userId,
      type,
      title,
      content,
      relatedId,
      read: false,
      createdAt: new Date()
    });
    await this.notificationRepository.save(notification);
  }
}

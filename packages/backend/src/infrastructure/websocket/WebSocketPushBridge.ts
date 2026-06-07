import Redis from 'ioredis';
import { getEventBus } from '../events/EventBusFactory';
import type { IDomainEvent } from '../../domain/shared/events/IEventBus';
import type {
  CommentRepliedEvent,
  MessageExpiredEvent,
  MessageRemovedEvent,
  PostApprovedEvent,
  PostRejectedEvent,
  PostRepliedEvent,
  PrivateMessageSentEvent,
} from '../../domain/shared/events/DomainEvents';
import { wsConnectionManager } from './WebSocketServer';

type WSMessageType = 'notification' | 'new_message' | 'post_updated' | 'message_removed' | 'message_expired';

interface WSMessage {
  type: WSMessageType;
  data: Record<string, unknown>;
}

let bootstrapped = false;
let publisher: Redis | null = null;

export function bootstrapWebSocketPushBridge(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  const eventBus = getEventBus();
  eventBus.subscribe<PostApprovedEvent>('PostApprovedEvent', async (event) => {
    await pushToUser(event.authorId, {
      type: 'notification',
      data: { eventName: event.eventName, postId: event.postId, notificationType: 'POST_APPROVED' },
    });
  });

  eventBus.subscribe<PostRejectedEvent>('PostRejectedEvent', async (event) => {
    await pushToUser(event.authorId, {
      type: 'notification',
      data: { eventName: event.eventName, postId: event.postId, notificationType: 'POST_REJECTED' },
    });
  });

  eventBus.subscribe<PostRepliedEvent>('PostRepliedEvent', async (event) => {
    if (event.authorId === event.replierId) return;
    await pushToUser(event.authorId, {
      type: 'notification',
      data: {
        eventName: event.eventName,
        postId: event.postId,
        commentId: event.commentId,
        notificationType: 'POST_REPLIED',
      },
    });
  });

  eventBus.subscribe<CommentRepliedEvent>('CommentRepliedEvent', async (event) => {
    if (event.authorId === event.replierId) return;
    await pushToUser(event.authorId, {
      type: 'notification',
      data: {
        eventName: event.eventName,
        postId: event.postId,
        commentId: event.childCommentId,
        notificationType: 'COMMENT_REPLIED',
      },
    });
  });

  eventBus.subscribe<PrivateMessageSentEvent>('PrivateMessageSentEvent', async (event) => {
    await pushToUser(event.receiverId, {
      type: 'new_message',
      data: {
        eventName: event.eventName,
        messageId: event.messageId,
        senderId: event.senderId,
        isSystem: event.isSystem,
      },
    });
  });

  eventBus.subscribe<MessageRemovedEvent>('MessageRemovedEvent', async (event) => {
    await pushToUser(event.targetUserId, {
      type: 'message_removed',
      data: {
        eventName: event.eventName,
        messageId: event.messageId,
        partnerId: event.partnerId,
        reason: event.reason,
      },
    });
  });

  eventBus.subscribe<MessageExpiredEvent>('MessageExpiredEvent', async (event) => {
    await pushToUser(event.receiverId, {
      type: 'message_expired',
      data: {
        eventName: event.eventName,
        messageId: event.messageId,
        expiresAt: event.expiresAt,
      },
    });
  });
}

async function pushToUser(userId: string, message: WSMessage): Promise<void> {
  if (!process.env.REDIS_URL) {
    wsConnectionManager.pushToUser(userId, message);
    return;
  }

  try {
    publisher ??= new Redis(process.env.REDIS_URL);
    await publisher.publish(`myndbbs:ws-push:${userId}`, JSON.stringify(message));
  } catch (err) {
    console.error('[WebSocketPushBridge] Redis publish failed, falling back to local push:', err);
    wsConnectionManager.pushToUser(userId, message);
  }
}

export function getTargetUserId(event: IDomainEvent): string | null {
  const payload = event as unknown as Record<string, unknown>;
  return typeof payload.targetUserId === 'string'
    ? payload.targetUserId
    : typeof payload.authorId === 'string'
      ? payload.authorId
      : typeof payload.receiverId === 'string'
        ? payload.receiverId
        : null;
}

export async function shutdownWebSocketPushBridge(): Promise<void> {
  if (publisher) {
    await publisher.quit();
    publisher = null;
  }
}

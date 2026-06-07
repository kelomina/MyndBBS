import { PrismaPrivateMessageRepository } from '../infrastructure/repositories/PrismaPrivateMessageRepository';
import { createWorker, CLEANUP_QUEUE_NAME, getCleanupQueue } from '../infrastructure/queues/queueFactory';
import { getEventBus } from '../infrastructure/events/EventBusFactory';
import { MessageRemovedEvent } from '../domain/shared/events/DomainEvents';

export function bootstrapMessageCleanup(): void {
  if (!process.env.REDIS_URL) {
    bootstrapFallbackCleanup();
    return;
  }

  const worker = createWorker(CLEANUP_QUEUE_NAME, async () => {
    const repo = new PrismaPrivateMessageRepository();
    try {
      const expiredMessages = await repo.findExpiredForCleanup();

      for (const msgData of expiredMessages) {
        if (msgData.deletedBy.includes(msgData.receiverId)) continue;

        const fullMessage = await repo.findById(msgData.id);
        if (!fullMessage) continue;

        const shouldHardDelete = fullMessage.deleteForUser(fullMessage.receiverId, false);

        if (shouldHardDelete) {
          await repo.delete(fullMessage.id);
        } else {
          await repo.save(fullMessage);
        }
        await getEventBus().publish(
          new MessageRemovedEvent(fullMessage.id, fullMessage.receiverId, fullMessage.senderId, 'expired'),
        );
      }
    } catch (err) {
      console.error('[MessageCleanup] Error cleaning expired messages:', err);
    }
  });

  worker.on('failed', (_job: unknown, err: Error) => {
    console.error('[MessageCleanup] Job failed:', err);
  });

  getCleanupQueue().add(
    'cleanup-expired-messages',
    {},
    {
      repeat: { every: 30000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  ).catch((err: unknown) => {
    console.error('[MessageCleanup] Failed to schedule repeatable job:', err);
    bootstrapFallbackCleanup();
  });
}

function bootstrapFallbackCleanup(): void {
  const repo = new PrismaPrivateMessageRepository();

  const cleanupTask = async () => {
    try {
      const expiredMessages = await repo.findExpiredForCleanup();

      for (const msgData of expiredMessages) {
        if (msgData.deletedBy.includes(msgData.receiverId)) continue;

        const fullMessage = await repo.findById(msgData.id);
        if (!fullMessage) continue;

        const shouldHardDelete = fullMessage.deleteForUser(fullMessage.receiverId, false);

        if (shouldHardDelete) {
          await repo.delete(fullMessage.id);
        } else {
          await repo.save(fullMessage);
        }
        await getEventBus().publish(
          new MessageRemovedEvent(fullMessage.id, fullMessage.receiverId, fullMessage.senderId, 'expired'),
        );
      }
    } catch (err) {
      console.error('[MessageCleanup] Error cleaning expired messages:', err);
    }
  };

  setInterval(cleanupTask, 30_000);
}

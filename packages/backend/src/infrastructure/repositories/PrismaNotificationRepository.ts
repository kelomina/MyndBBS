import { INotificationRepository } from '../../domain/notification/INotificationRepository';
import { Notification, NotificationProps } from '../../domain/notification/Notification';
import { prisma } from '../../db';

/**
 * Callers: [NotificationApplicationService.constructor]
 * Callees: [toDomain, findUnique, upsert, delete]
 * Description: The Prisma-based implementation of the INotificationRepository, mapping between raw Prisma rows and the Notification Domain Aggregate.
 * Keywords: prisma, notification, repository, implementation, infrastructure
 */
export class PrismaNotificationRepository implements INotificationRepository {
  /**
   * Callers: [findById]
   * Callees: [Notification.create]
   * Description: Maps a raw Prisma notification row to the Notification Domain Aggregate Root.
   * Keywords: mapper, domain, prisma, convert, notification
   */
  private toDomain(raw: any): Notification {
    const props: NotificationProps = {
      id: raw.id,
      userId: raw.userId,
      type: raw.type,
      title: raw.title,
      content: raw.content,
      relatedId: raw.relatedId,
      read: raw.read,
      createdAt: raw.createdAt,
    };
    return Notification.create(props);
  }

  /**
   * Callers: [NotificationApplicationService]
   * Callees: [prisma.notification.findUnique, toDomain]
   * Description: Retrieves a Notification aggregate from the Prisma database using its ID.
   * Keywords: find, id, prisma, repository, notification
   */
  public async findById(id: string): Promise<Notification | null> {
    const raw = await prisma.notification.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  /**
   * Callers: [NotificationApplicationService]
   * Callees: [prisma.notification.upsert]
   * Description: Persists the state of a Notification aggregate. Creates it if it doesn't exist, updates it if it does.
   * Keywords: save, upsert, update, create, prisma, repository, notification
   */
  public async save(notification: Notification): Promise<void> {
    await prisma.notification.upsert({
      where: { id: notification.id },
      create: {
        id: notification.id,
        userId: notification.userId,
        type: notification.type as any,
        title: notification.title,
        content: notification.content,
        relatedId: notification.relatedId,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      },
      update: {
        isRead: notification.isRead,
      },
    });
  }

  /**
   * Callers: [NotificationApplicationService]
   * Callees: [prisma.notification.delete]
   * Description: Permanently removes a Notification from the Prisma database.
   * Keywords: delete, remove, physical, prisma, repository, notification
   */
  public async delete(id: string): Promise<void> {
    await prisma.notification.delete({ where: { id } });
  }
}

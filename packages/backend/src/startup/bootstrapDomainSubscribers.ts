import { NotificationApplicationService } from '../application/notification/NotificationApplicationService';
import { PrismaNotificationRepository } from '../infrastructure/repositories/PrismaNotificationRepository';
import { globalEventBus } from '../infrastructure/events/InMemoryEventBus';
import { PrismaModeratorReadModel } from '../infrastructure/repositories/PrismaModeratorReadModel';

export function bootstrapDomainSubscribers(): void {
  new NotificationApplicationService(
    new PrismaNotificationRepository(), 
    globalEventBus,
    new PrismaModeratorReadModel()
  );
}

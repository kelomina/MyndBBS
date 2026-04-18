import { NotificationApplicationService } from '../application/notification/NotificationApplicationService';
import { PrismaNotificationRepository } from '../infrastructure/repositories/PrismaNotificationRepository';
import { globalEventBus } from '../infrastructure/events/InMemoryEventBus';
import { PrismaModeratorReadModel } from '../infrastructure/queries/PrismaModeratorReadModel';
import { unitOfWork } from '../registry';

export function bootstrapDomainSubscribers(): void {
  new NotificationApplicationService(
    new PrismaNotificationRepository(), 
    globalEventBus,
    new PrismaModeratorReadModel(),
    unitOfWork
  );
}

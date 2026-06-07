import { NotificationApplicationService } from '../application/notification/NotificationApplicationService';
import { PrismaNotificationRepository } from '../infrastructure/repositories/PrismaNotificationRepository';
import { getEventBus } from '../infrastructure/events/EventBusFactory';
import { PrismaModeratorReadModel } from '../infrastructure/queries/PrismaModeratorReadModel';
import { unitOfWork } from '../registry';

export function bootstrapDomainSubscribers(): void {
  new NotificationApplicationService(
    new PrismaNotificationRepository(),
    getEventBus(),
    new PrismaModeratorReadModel(),
    unitOfWork,
  );
}

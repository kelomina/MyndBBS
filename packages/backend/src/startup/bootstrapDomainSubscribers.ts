import { NotificationApplicationService } from '../application/notification/NotificationApplicationService';
import { PrismaNotificationRepository } from '../infrastructure/repositories/PrismaNotificationRepository';
import { getEventBus } from '../infrastructure/events/EventBusFactory';
import { PrismaModeratorReadModel } from '../infrastructure/queries/PrismaModeratorReadModel';
import { BadgeEventListener } from '../infrastructure/events/handlers/BadgeEventListener';
import { PrismaUserDeliveryInfoAdapter } from '../infrastructure/services/PrismaUserDeliveryInfoAdapter';
import { QueuedEmailSender } from '../infrastructure/services/identity/QueuedEmailSender';
import { SmtpEmailSender } from '../infrastructure/services/identity/SmtpEmailSender';
import { PrismaEmailTemplateRepository } from '../infrastructure/repositories/PrismaEmailTemplateRepository';
import { PrivateMessageEmailNotifier } from '../application/notification/PrivateMessageEmailNotifier';
import { badgeApplicationService, unitOfWork } from '../registry';

export function bootstrapDomainSubscribers(): void {
  const emailSender = new QueuedEmailSender(new SmtpEmailSender());
  const userDeliveryInfo = new PrismaUserDeliveryInfoAdapter();

  new NotificationApplicationService(
    new PrismaNotificationRepository(),
    getEventBus(),
    new PrismaModeratorReadModel(),
    unitOfWork,
    {
      emailSender,
      emailTemplateRepository: new PrismaEmailTemplateRepository() as unknown as {
        findByType(type: string): Promise<{
          render(variables: Record<string, string>): { subject: string; textBody: string; htmlBody: string };
        } | null>;
      },
      userDeliveryInfo,
    }
  );

  new PrivateMessageEmailNotifier({ emailSender, userDeliveryInfo }).register(getEventBus());

  new BadgeEventListener(getEventBus(), badgeApplicationService);
}

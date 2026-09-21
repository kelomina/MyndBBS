import { PrivateMessageSentEvent } from '../../domain/shared/events/DomainEvents';
import type { IEventBus } from '../../domain/shared/events/IEventBus';
import type { IUserDeliveryInfoPort } from './ports/IUserDeliveryInfoPort';

export interface PrivateMessageEmailSender {
  sendEmail(command: {
    to: string;
    subject: string;
    textBody: string;
    htmlBody: string;
  }): Promise<void>;
}

export interface PrivateMessageEmailNotifierOptions {
  emailSender: PrivateMessageEmailSender;
  userDeliveryInfo: IUserDeliveryInfoPort;
  frontendUrl?: string;
}

export class PrivateMessageEmailNotifier {
  constructor(private readonly options: PrivateMessageEmailNotifierOptions) {}

  public register(eventBus: IEventBus): void {
    eventBus.subscribe<PrivateMessageSentEvent>('PrivateMessageSentEvent', async (event) => {
      await this.notifyReceiver(event);
    });
  }

  private async notifyReceiver(event: PrivateMessageSentEvent): Promise<void> {
    if (event.isSystem) return;

    try {
      const deliveryInfo = await this.options.userDeliveryInfo.getDeliveryInfo(event.receiverId);
      if (!deliveryInfo?.emailNotificationsEnabled) return;

      const subject = 'You have a new unread private message';
      const messagesUrl = `${(this.options.frontendUrl ?? process.env.FRONTEND_URL ?? '').replace(/\/$/, '')}/messages`;
      const textBody = `${subject}. Open MyndBBS to read it: ${messagesUrl}`;
      const htmlBody = `<p>${subject}.</p><p><a href="${escapeHtml(messagesUrl)}">Open MyndBBS messages</a></p>`;

      await this.options.emailSender.sendEmail({
        to: deliveryInfo.email,
        subject: `[MyndBBS] ${subject}`,
        textBody,
        htmlBody,
      });
    } catch (error) {
      console.error('[PrivateMessageEmailNotifier] email delivery failed:', error);
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

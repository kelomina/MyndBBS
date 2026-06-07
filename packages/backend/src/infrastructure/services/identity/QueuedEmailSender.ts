import type { IEmailSender, SendEmailCommand } from '../../../domain/identity/ports/IEmailSender';
import { getEmailQueue } from '../../queues/queueFactory';

export class QueuedEmailSender implements IEmailSender {
  constructor(private readonly fallbackSender: IEmailSender) {}

  async sendEmail(command: SendEmailCommand): Promise<void> {
    if (process.env.REDIS_URL) {
      try {
        await getEmailQueue().add(
          'send-email',
          {
            to: command.to,
            subject: command.subject,
            textBody: command.textBody,
            htmlBody: command.htmlBody,
          },
          {
            attempts: 5,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: true,
            removeOnFail: { age: 86400 },
          },
        );
        return;
      } catch (err) {
        console.error('[QueuedEmailSender] Failed to enqueue email, falling back to direct send:', err);
      }
    }

    await this.fallbackSender.sendEmail(command);
  }
}

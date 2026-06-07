import { createWorker, EMAIL_QUEUE_NAME } from '../../queues/queueFactory';
import { SmtpEmailSender } from './SmtpEmailSender';
import type { SendEmailCommand } from '../../../domain/identity/ports/IEmailSender';

const smtpSender = new SmtpEmailSender();

export function bootstrapEmailWorker(): void {
  if (!process.env.REDIS_URL) return;

  const worker = createWorker(EMAIL_QUEUE_NAME, async (job) => {
    const command = job.data as SendEmailCommand;
    await smtpSender.sendEmail(command);
  }, {
    concurrency: 5,
    limiter: { max: 50, duration: 60000 },
    settings: {
      backoffStrategy: (attemptsMade: number) => Math.min(attemptsMade ** 2 * 1000, 60000),
    },
  });

  worker.on('failed', (_job: unknown, err: Error) => {
    console.error('[EmailWorker] Job failed:', err);
  });
}

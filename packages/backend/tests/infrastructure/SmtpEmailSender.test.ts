jest.mock('nodemailer', () => {
  const sendMail = jest.fn().mockResolvedValue({ envelope: { to: ['user@example.com'] } });
  const createTransport = jest.fn().mockReturnValue({ sendMail });

  return {
    __esModule: true,
    default: {
      createTransport,
    },
    createTransport,
  };
});

import nodemailer from 'nodemailer';
import { SmtpEmailSender } from '../../src/infrastructure/services/identity/SmtpEmailSender';

describe('SmtpEmailSender', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSmtpHost = process.env.SMTP_HOST;
  const originalSmtpFrom = process.env.SMTP_FROM;
  const originalSmtpPort = process.env.SMTP_PORT;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;
    delete process.env.SMTP_PORT;
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.SMTP_HOST = originalSmtpHost;
    process.env.SMTP_FROM = originalSmtpFrom;
    process.env.SMTP_PORT = originalSmtpPort;
  });

  it('uses development JSON transport when SMTP is not configured', async () => {
    const sender = new SmtpEmailSender();

    await sender.sendEmail({
      to: 'user@example.com',
      subject: 'subject',
      textBody: 'text',
      htmlBody: '<p>text</p>',
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith({ jsonTransport: true });
  });

  it('uses SMTP transport when configuration is provided', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_FROM = 'MyndBBS <no-reply@example.com>';
    process.env.SMTP_PORT = '587';

    const sender = new SmtpEmailSender();

    await sender.sendEmail({
      to: 'user@example.com',
      subject: 'subject',
      textBody: 'text',
      htmlBody: '<p>text</p>',
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
      })
    );
  });
});

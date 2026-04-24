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
  const originalSmtpUser = process.env.SMTP_USER;
  const originalSmtpPass = process.env.SMTP_PASS;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.SMTP_HOST = originalSmtpHost;
    process.env.SMTP_FROM = originalSmtpFrom;
    process.env.SMTP_PORT = originalSmtpPort;
    process.env.SMTP_USER = originalSmtpUser;
    process.env.SMTP_PASS = originalSmtpPass;
  });

  it('uses development JSON transport when SMTP is not configured', async () => {
    const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const sender = new SmtpEmailSender();

    try {
      await sender.sendEmail({
        to: 'user@example.com',
        subject: 'subject',
        textBody: 'text',
        htmlBody: '<p>text</p>',
      });

      expect(nodemailer.createTransport).toHaveBeenCalledWith({ jsonTransport: true });
    } finally {
      consoleInfoSpy.mockRestore();
    }
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

  it('preserves the not-configured error in production without SMTP settings', async () => {
    process.env.NODE_ENV = 'production';

    const sender = new SmtpEmailSender();

    await expect(sender.sendEmail({
      to: 'user@example.com',
      subject: 'subject',
      textBody: 'text',
      htmlBody: '<p>text</p>',
    })).rejects.toThrow('ERR_EMAIL_DELIVERY_NOT_CONFIGURED');
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('wraps SMTP transport failures as delivery failures', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_FROM = 'MyndBBS <no-reply@example.com>';
    process.env.SMTP_PORT = '587';
    const sendMail = jest.fn().mockRejectedValue(new Error('SMTP_DOWN'));
    (nodemailer.createTransport as jest.Mock).mockReturnValueOnce({ sendMail });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const sender = new SmtpEmailSender();

    try {
      await expect(sender.sendEmail({
        to: 'user@example.com',
        subject: 'subject',
        textBody: 'text',
        htmlBody: '<p>text</p>',
      })).rejects.toThrow('ERR_EMAIL_DELIVERY_FAILED');
      expect(sendMail).toHaveBeenCalledTimes(1);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

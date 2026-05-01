import { IEnvStore, SmtpConfigInput } from '../../domain/provisioning/IEnvStore';
import { IEmailTemplateRepository } from '../../domain/notification/IEmailTemplateRepository';
import { EmailTemplate, EmailTemplateType } from '../../domain/notification/EmailTemplate';
import { SmtpEmailSender } from '../../infrastructure/services/identity/SmtpEmailSender';
import nodemailer from 'nodemailer';
import { randomUUID as uuidv4 } from 'crypto';

export interface SmtpConfigView {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface EmailTemplateView {
  type: EmailTemplateType;
  subject: string;
  textBody: string;
  htmlBody: string;
}

const DEFAULT_TEMPLATES: Record<EmailTemplateType, Omit<EmailTemplateView, 'type'>> = {
  [EmailTemplateType.REGISTRATION_VERIFICATION]: {
    subject: '{{appName}} email verification',
    textBody: [
      'Hello {{username}},',
      '',
      'Please verify your {{appName}} registration by opening the link below:',
      '{{verificationLink}}',
      '',
      'This link expires in {{expiresInMinutes}} minutes.',
      '',
      'If you did not start this registration, you can safely ignore this email.',
    ].join('\n'),
    htmlBody: [
      '<p>Hello {{username}},</p>',
      '<p>Please verify your <strong>{{appName}}</strong> registration by opening the link below:</p>',
      '<p><a href="{{verificationLink}}">{{verificationLink}}</a></p>',
      '<p>This link expires in <strong>{{expiresInMinutes}} minutes</strong>.</p>',
      '<p>If you did not start this registration, you can safely ignore this email.</p>',
    ].join(''),
  },
  [EmailTemplateType.PASSWORD_RESET]: {
    subject: '{{appName}} password reset',
    textBody: [
      'Hello {{username}},',
      '',
      'You requested a password reset for {{appName}}. Open the link below to choose a new password:',
      '{{resetLink}}',
      '',
      'This link expires in {{expiresInMinutes}} minutes.',
      '',
      'If you did not request a password reset, you can safely ignore this email.',
    ].join('\n'),
    htmlBody: [
      '<p>Hello {{username}},</p>',
      '<p>You requested a password reset for <strong>{{appName}}</strong>. Open the link below to choose a new password:</p>',
      '<p><a href="{{resetLink}}">{{resetLink}}</a></p>',
      '<p>This link expires in <strong>{{expiresInMinutes}} minutes</strong>.</p>',
      '<p>If you did not request a password reset, you can safely ignore this email.</p>',
    ].join(''),
  },
  [EmailTemplateType.TEST]: {
    subject: '{{appName}} test email',
    textBody: [
      'Hello,',
      '',
      'This is a test email from {{appName}}.',
      '',
      'If you received this email, your SMTP configuration is working correctly.',
    ].join('\n'),
    htmlBody: [
      '<p>Hello,</p>',
      '<p>This is a test email from <strong>{{appName}}</strong>.</p>',
      '<p>If you received this email, your SMTP configuration is working correctly.</p>',
    ].join(''),
  },
};

export class EmailConfigurationApplicationService {
  constructor(
    private envStore: IEnvStore,
    private emailTemplateRepository: IEmailTemplateRepository,
  ) {}

  public getSmtpConfig(operatorRole?: string): SmtpConfigView {
    if (operatorRole !== 'SUPER_ADMIN') {
      throw new Error('ERR_FORBIDDEN_SUPER_ADMIN_ONLY');
    }

    return {
      host: process.env.SMTP_HOST?.trim() || '',
      port: Number(process.env.SMTP_PORT?.trim() || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER?.trim() || '',
      pass: process.env.SMTP_PASS?.trim() || '',
      from: process.env.SMTP_FROM?.trim() || '',
    };
  }

  public async updateSmtpConfig(config: SmtpConfigInput, operatorRole?: string): Promise<void> {
    if (operatorRole !== 'SUPER_ADMIN') {
      throw new Error('ERR_FORBIDDEN_SUPER_ADMIN_ONLY');
    }

    await this.envStore.updateSmtpConfig(config);
  }

  public async getEmailTemplates(operatorRole?: string): Promise<EmailTemplateView[]> {
    if (operatorRole !== 'SUPER_ADMIN') {
      throw new Error('ERR_FORBIDDEN_SUPER_ADMIN_ONLY');
    }

    const templates = await this.emailTemplateRepository.findAll();
    const types = Object.values(EmailTemplateType);

    const result: EmailTemplateView[] = [];
    for (const type of types) {
      const existing = templates.find((t) => t.type === type);
      if (existing) {
        result.push({
          type: existing.type,
          subject: existing.subject,
          textBody: existing.textBody,
          htmlBody: existing.htmlBody,
        });
      }
    }

    for (const type of types) {
      if (!result.find((t) => t.type === type)) {
        result.push({
          type,
          ...DEFAULT_TEMPLATES[type],
        });
      }
    }

    return result;
  }

  public async updateEmailTemplate(
    type: EmailTemplateType,
    subject: string,
    textBody: string,
    htmlBody: string,
    operatorRole?: string,
  ): Promise<void> {
    if (operatorRole !== 'SUPER_ADMIN') {
      throw new Error('ERR_FORBIDDEN_SUPER_ADMIN_ONLY');
    }

    const template = EmailTemplate.create({
      id: uuidv4(),
      type,
      subject,
      textBody,
      htmlBody,
      updatedAt: new Date(),
    });

    await this.emailTemplateRepository.upsert(template);
  }

  public async sendTestEmail(
    targetEmail: string,
    smtpConfig?: SmtpConfigInput,
    operatorRole?: string,
  ): Promise<void> {
    if (operatorRole !== 'SUPER_ADMIN') {
      throw new Error('ERR_FORBIDDEN_SUPER_ADMIN_ONLY');
    }

    if (smtpConfig) {
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: smtpConfig.user ? { user: smtpConfig.user, pass: smtpConfig.pass } : undefined,
      });

      await transporter.sendMail({
        from: smtpConfig.from,
        to: targetEmail,
        subject: 'MyndBBS Test Email',
        text: 'This is a test email from MyndBBS. If you received this, your SMTP configuration is working correctly.',
        html: '<p>This is a test email from <strong>MyndBBS</strong>.</p><p>If you received this, your SMTP configuration is working correctly.</p>',
      });
    } else {
      const sender = new SmtpEmailSender();
      await sender.sendEmail({
        to: targetEmail,
        subject: 'MyndBBS Test Email',
        textBody: 'This is a test email from MyndBBS. If you received this, your SMTP configuration is working correctly.',
        htmlBody: '<p>This is a test email from <strong>MyndBBS</strong>.</p><p>If you received this, your SMTP configuration is working correctly.</p>',
      });
    }
  }
}

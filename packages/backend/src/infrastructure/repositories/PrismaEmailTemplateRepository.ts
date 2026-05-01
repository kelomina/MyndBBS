import { IEmailTemplateRepository } from '../../domain/notification/IEmailTemplateRepository';
import { EmailTemplate, EmailTemplateProps, EmailTemplateType } from '../../domain/notification/EmailTemplate';
import { prisma } from '../../db';

export class PrismaEmailTemplateRepository implements IEmailTemplateRepository {
  private toDomain(raw: {
    id: string;
    type: string;
    subject: string;
    textBody: string;
    htmlBody: string;
    updatedAt: Date;
  }): EmailTemplate {
    const props: EmailTemplateProps = {
      id: raw.id,
      type: raw.type as EmailTemplateType,
      subject: raw.subject,
      textBody: raw.textBody,
      htmlBody: raw.htmlBody,
      updatedAt: raw.updatedAt,
    };
    return EmailTemplate.restore(props);
  }

  public async findByType(type: EmailTemplateType): Promise<EmailTemplate | null> {
    const raw = await prisma.emailTemplate.findUnique({ where: { type } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  public async findAll(): Promise<EmailTemplate[]> {
    const raws = await prisma.emailTemplate.findMany();
    return raws.map((raw) => this.toDomain(raw));
  }

  public async upsert(template: EmailTemplate): Promise<void> {
    await prisma.emailTemplate.upsert({
      where: { type: template.type },
      create: {
        id: template.id,
        type: template.type,
        subject: template.subject,
        textBody: template.textBody,
        htmlBody: template.htmlBody,
      },
      update: {
        subject: template.subject,
        textBody: template.textBody,
        htmlBody: template.htmlBody,
      },
    });
  }
}

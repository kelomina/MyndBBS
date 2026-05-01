import { EmailTemplate, EmailTemplateType } from './EmailTemplate';

export interface IEmailTemplateRepository {
  findByType(type: EmailTemplateType): Promise<EmailTemplate | null>;
  findAll(): Promise<EmailTemplate[]>;
  upsert(template: EmailTemplate): Promise<void>;
}

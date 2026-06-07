import { EmailTemplate, EmailTemplateType } from './EmailTemplate';

/**
 * 接口名称：IEmailTemplateRepository
 *
 * 函数作用：
 *   邮件模板的仓储接口。
 * Purpose:
 *   Repository interface for EmailTemplate aggregates.
 *
 * 中文关键词：
 *   邮件模板，仓储接口
 * English keywords:
 *   email template, repository interface
 */
export interface IEmailTemplateRepository {
  findByType(type: EmailTemplateType): Promise<EmailTemplate | null>;
  findAll(): Promise<EmailTemplate[]>;
  upsert(template: EmailTemplate): Promise<void>;
}

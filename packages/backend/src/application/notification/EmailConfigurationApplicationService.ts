import { IEnvStore, SmtpConfigInput } from '../../domain/provisioning/IEnvStore'
import { IEmailTemplateRepository } from '../../domain/notification/IEmailTemplateRepository'
import { EmailTemplate, EmailTemplateType } from '../../domain/notification/EmailTemplate'
import { SmtpEmailSender } from '../../infrastructure/services/identity/SmtpEmailSender'
import nodemailer from 'nodemailer'
import { randomUUID as uuidv4 } from 'crypto'

/**
 * SMTP 配置的只读视图 DTO。用于向前端返回邮件服务器配置。
 *
 * Read-only SMTP configuration DTO. Used to return mail server configuration to the frontend.
 */
export interface SmtpConfigView {
  /** SMTP 主机地址 / SMTP host address */
  host: string
  /** SMTP 端口号 / SMTP port number */
  port: number
  /** 是否使用 SSL/TLS 安全连接 / Whether to use SSL/TLS secure connection */
  secure: boolean
  /** SMTP 认证用户名 / SMTP authentication username */
  user: string
  /** SMTP 认证密码 / SMTP authentication password */
  pass: string
  /** 发件人地址 / Sender email address */
  from: string
}

/**
 * 邮件模板的只读视图 DTO。用于向前端展示邮件模板的内容和类型。
 *
 * Read-only email template view DTO. Used to display email template content and type to the frontend.
 */
export interface EmailTemplateView {
  /** 邮件模板类型（注册验证/密码重置/测试邮件）/ Email template type (registration verification / password reset / test) */
  type: EmailTemplateType
  /** 邮件主题 / Email subject */
  subject: string
  /** 纯文本正文 / Plain text body */
  textBody: string
  /** HTML 正文 / HTML body */
  htmlBody: string
}

/**
 * 默认邮件模板集合。当数据库中不存在对应类型的模板时，使用这些硬编码的默认模板作为回退。
 * 包含三种模板：注册验证邮件、密码重置邮件、测试邮件。
 * 模板使用 {{variableName}} 格式的占位符，支持变量替换。
 *
 * Default email template collection. Used as fallback when no template of the corresponding type
 * exists in the database. Includes three templates: registration verification, password reset, and test.
 * Templates use {{variableName}} placeholders for variable substitution.
 */
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
}

/**
 * Function: class EmailConfigurationApplicationService
 * ----------------------------------------------------
 * 邮件配置应用服务。管理 SMTP 配置和邮件模板的查询与更新，提供测试邮件发送功能。
 * 所有操作都要求操作者角色为 SUPER_ADMIN。
 *
 * Email configuration application service. Manages SMTP configuration and email template
 * query/update operations, and provides test email sending capability.
 * All operations require the operator's role to be SUPER_ADMIN.
 *
 * Callers: [AdminController (admin.ts)]
 * Called by: [AdminController (admin.ts)]
 *
 * Callees: [IEnvStore, IEmailTemplateRepository, EmailTemplate, SmtpEmailSender, nodemailer]
 * Calls: [IEnvStore, IEmailTemplateRepository, EmailTemplate, SmtpEmailSender, nodemailer]
 *
 * Keywords: email configuration, smtp, email template, test email, super admin,
 *           邮件配置, SMTP, 邮件模板, 测试邮件, 超级管理员
 */
export class EmailConfigurationApplicationService {
  /**
   * Function: constructor
   * ----------------------
   * 通过依赖注入初始化服务实例。
   *
   * Initializes the service instance via Dependency Injection.
   *
   * Parameters:
   * - envStore: IEnvStore, 环境存储适配器，用于读写 SMTP 配置 / environment store adapter for SMTP config
   * - emailTemplateRepository: IEmailTemplateRepository, 邮件模板仓储 / email template repository
   *
   * Returns: EmailConfigurationApplicationService 实例 / an instance of EmailConfigurationApplicationService
   */
  constructor(
    private envStore: IEnvStore,
    private emailTemplateRepository: IEmailTemplateRepository,
  ) {}

  /**
   * Function: getSmtpConfig
   * ------------------------
   * 获取当前 SMTP 配置。从环境变量中读取 SMTP 主机、端口、安全连接、用户名、密码和发件人地址。
   * 仅 SUPER_ADMIN 角色可调用。
   *
   * Retrieves the current SMTP configuration. Reads SMTP host, port, secure connection flag,
   * username, password, and sender address from environment variables.
   * Only accessible by SUPER_ADMIN role.
   *
   * Callers: [AdminController.getEmailConfig]
   * Called by: [AdminController.getEmailConfig]
   *
   * Callees: [process.env]
   * Calls: [process.env]
   *
   * Parameters:
   * - operatorRole: string | undefined, 操作者角色名，必须为 'SUPER_ADMIN'
   *   the operator's role name, must be 'SUPER_ADMIN'
   *
   * Returns:
   * - SmtpConfigView, SMTP 配置只读视图 / SMTP configuration read-only view
   *
   * Error Handling / 错误处理:
   * - ERR_FORBIDDEN_SUPER_ADMIN_ONLY: 操作者不是 SUPER_ADMIN / operator is not SUPER_ADMIN
   *
   * Side Effects / 副作用:
   * - 无副作用，纯读取 / no side effects, pure read
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: SMTP配置, 邮件服务器, 环境变量, 主机端口, 发件人, 超级管理员权限
   * English keywords: SMTP config, mail server, environment variable, host port, sender, super admin permission
   */
  public getSmtpConfig(operatorRole?: string): SmtpConfigView {
    if (operatorRole !== 'SUPER_ADMIN') {
      throw new Error('ERR_FORBIDDEN_SUPER_ADMIN_ONLY')
    }

    return {
      host: process.env.SMTP_HOST?.trim() || '',
      port: Number(process.env.SMTP_PORT?.trim() || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER?.trim() || '',
      pass: process.env.SMTP_PASS?.trim() || '',
      from: process.env.SMTP_FROM?.trim() || '',
    }
  }

  /**
   * Function: updateSmtpConfig
   * ---------------------------
   * 更新 SMTP 配置。将传入的配置保存到环境存储中，仅 SUPER_ADMIN 角色可调用。
   *
   * Updates the SMTP configuration. Persists the provided config to the environment store.
   * Only accessible by SUPER_ADMIN role.
   *
   * Callers: [AdminController.updateEmailConfig]
   * Called by: [AdminController.updateEmailConfig]
   *
   * Callees: [IEnvStore.updateSmtpConfig]
   * Calls: [IEnvStore.updateSmtpConfig]
   *
   * Parameters:
   * - config: SmtpConfigInput, SMTP 配置输入（主机、端口、安全、用户名、密码、发件人）
   *   SMTP configuration input (host, port, secure, user, pass, from)
   * - operatorRole: string | undefined, 操作者角色名，必须为 'SUPER_ADMIN'
   *   the operator's role name, must be 'SUPER_ADMIN'
   *
   * Returns:
   * - Promise<void>, 无返回值 / no return value
   *
   * Error Handling / 错误处理:
   * - ERR_FORBIDDEN_SUPER_ADMIN_ONLY: 操作者不是 SUPER_ADMIN / operator is not SUPER_ADMIN
   *
   * Side Effects / 副作用:
   * - 写入环境存储（持久化 SMTP 配置）/ writes to environment store (persists SMTP config)
   *
   * Transaction / 事务:
   * - 无事务边界，单次写入 / no transaction boundary, single write
   *
   * 中文关键词: SMTP配置更新, 邮件服务器, 环境存储, 配置持久化, 超级管理员权限
   * English keywords: SMTP config update, mail server, environment store, config persistence, super admin permission
   */
  public async updateSmtpConfig(config: SmtpConfigInput, operatorRole?: string): Promise<void> {
    if (operatorRole !== 'SUPER_ADMIN') {
      throw new Error('ERR_FORBIDDEN_SUPER_ADMIN_ONLY')
    }

    await this.envStore.updateSmtpConfig(config)
  }

  /**
   * Function: getEmailTemplates
   * ----------------------------
   * 获取所有邮件模板。先从数据库加载已有的模板，然后与所有模板类型做合并，
   * 对于数据库中缺失的模板类型，使用默认模板作为回退。
   * 仅 SUPER_ADMIN 角色可调用。
   *
   * Retrieves all email templates. First loads existing templates from the database,
   * then merges them with all template types. For template types missing in the database,
   * falls back to default templates.
   * Only accessible by SUPER_ADMIN role.
   *
   * Callers: [AdminController.getEmailConfig]
   * Called by: [AdminController.getEmailConfig]
   *
   * Callees: [IEmailTemplateRepository.findAll, DEFAULT_TEMPLATES]
   * Calls: [IEmailTemplateRepository.findAll, DEFAULT_TEMPLATES]
   *
   * Parameters:
   * - operatorRole: string | undefined, 操作者角色名，必须为 'SUPER_ADMIN'
   *   the operator's role name, must be 'SUPER_ADMIN'
   *
   * Returns:
   * - Promise<EmailTemplateView[]>, 邮件模板视图数组（包含所有模板类型）
   *   array of email template views (covering all template types)
   *
   * Error Handling / 错误处理:
   * - ERR_FORBIDDEN_SUPER_ADMIN_ONLY: 操作者不是 SUPER_ADMIN / operator is not SUPER_ADMIN
   *
   * Side Effects / 副作用:
   * - 无副作用，纯读取 / no side effects, pure read
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 邮件模板, 模板查询, 默认模板, 模板合并, 数据库模板, 回退策略, 超级管理员
   * English keywords: email template, template query, default template, template merge, database template, fallback strategy, super admin
   */
  public async getEmailTemplates(operatorRole?: string): Promise<EmailTemplateView[]> {
    if (operatorRole !== 'SUPER_ADMIN') {
      throw new Error('ERR_FORBIDDEN_SUPER_ADMIN_ONLY')
    }

    const templates = await this.emailTemplateRepository.findAll()
    const types = Object.values(EmailTemplateType)

    const result: EmailTemplateView[] = []
    for (const type of types) {
      const existing = templates.find((t) => t.type === type)
      if (existing) {
        result.push({
          type: existing.type,
          subject: existing.subject,
          textBody: existing.textBody,
          htmlBody: existing.htmlBody,
        })
      }
    }

    for (const type of types) {
      if (!result.find((t) => t.type === type)) {
        result.push({
          type,
          ...DEFAULT_TEMPLATES[type],
        })
      }
    }

    return result
  }

  /**
   * Function: updateEmailTemplate
   * -------------------------------
   * 更新指定类型的邮件模板。使用 EmailTemplate 工厂方法创建领域实体，然后通过仓储执行 upsert（存在则更新，不存在则创建）。
   * 仅 SUPER_ADMIN 角色可调用。
   *
   * Updates the email template for the specified type. Creates a domain entity via the EmailTemplate
   * factory method, then performs an upsert (update if exists, insert if not) through the repository.
   * Only accessible by SUPER_ADMIN role.
   *
   * Callers: [AdminController.updateEmailTemplate]
   * Called by: [AdminController.updateEmailTemplate]
   *
   * Callees: [EmailTemplate.create, IEmailTemplateRepository.upsert]
   * Calls: [EmailTemplate.create, IEmailTemplateRepository.upsert]
   *
   * Parameters:
   * - type: EmailTemplateType, 邮件模板类型 / the email template type
   * - subject: string, 邮件主题 / the email subject
   * - textBody: string, 纯文本正文 / the plain text body
   * - htmlBody: string, HTML 正文 / the HTML body
   * - operatorRole: string | undefined, 操作者角色名，必须为 'SUPER_ADMIN'
   *   the operator's role name, must be 'SUPER_ADMIN'
   *
   * Returns:
   * - Promise<void>, 无返回值 / no return value
   *
   * Error Handling / 错误处理:
   * - ERR_FORBIDDEN_SUPER_ADMIN_ONLY: 操作者不是 SUPER_ADMIN / operator is not SUPER_ADMIN
   *
   * Side Effects / 副作用:
   * - 写入数据库（模板 upsert）/ writes to database (template upsert)
   *
   * Transaction / 事务:
   * - 无事务边界，单次写入 / no transaction boundary, single write
   *
   * 中文关键词: 邮件模板更新, 模板编辑, 类型指定, upsert, 领域实体, 模板内容, 超级管理员
   * English keywords: email template update, template edit, type specification, upsert, domain entity, template content, super admin
   */
  public async updateEmailTemplate(
    type: EmailTemplateType,
    subject: string,
    textBody: string,
    htmlBody: string,
    operatorRole?: string,
  ): Promise<void> {
    if (operatorRole !== 'SUPER_ADMIN') {
      throw new Error('ERR_FORBIDDEN_SUPER_ADMIN_ONLY')
    }

    const template = EmailTemplate.create({
      id: uuidv4(),
      type,
      subject,
      textBody,
      htmlBody,
      updatedAt: new Date(),
    })

    await this.emailTemplateRepository.upsert(template)
  }

  /**
   * Function: sendTestEmail
   * -------------------------
   * 发送测试邮件以验证 SMTP 配置是否正常工作。
   * 如果提供了 smtpConfig 参数，则使用该配置通过 nodemailer 直接发送（不保存配置）；
   * 否则使用已保存的 SMTP 配置通过 SmtpEmailSender 发送。
   * 仅 SUPER_ADMIN 角色可调用。
   *
   * Sends a test email to verify that the SMTP configuration is working correctly.
   * If smtpConfig parameter is provided, sends directly via nodemailer using that config
   * (without persisting it); otherwise uses the saved SMTP configuration via SmtpEmailSender.
   * Only accessible by SUPER_ADMIN role.
   *
   * Callers: [AdminController.sendTestEmail]
   * Called by: [AdminController.sendTestEmail]
   *
   * Callees: [nodemailer.createTransport, nodemailer.transporter.sendMail, SmtpEmailSender.sendEmail]
   * Calls: [nodemailer.createTransport, nodemailer.transporter.sendMail, SmtpEmailSender.sendEmail]
   *
   * Parameters:
   * - targetEmail: string, 测试邮件的目标收件地址 / the target email address for the test
   * - smtpConfig: SmtpConfigInput | undefined, 可选，临时使用的 SMTP 配置（不保存）
   *   optional SMTP config to use temporarily (not persisted)
   * - operatorRole: string | undefined, 操作者角色名，必须为 'SUPER_ADMIN'
   *   the operator's role name, must be 'SUPER_ADMIN'
   *
   * Returns:
   * - Promise<void>, 无返回值 / no return value
   *
   * Error Handling / 错误处理:
   * - ERR_FORBIDDEN_SUPER_ADMIN_ONLY: 操作者不是 SUPER_ADMIN / operator is not SUPER_ADMIN
   * - SMTP 连接失败、认证失败或收件人拒绝时抛出 nodemailer 异常
   *   Throws nodemailer exceptions on SMTP connection failure, auth failure, or recipient rejection
   *
   * Side Effects / 副作用:
   * - 发送邮件（可能产生出站网络请求）/ sends an email (may produce outbound network request)
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 测试邮件, SMTP验证, 邮件发送, 配置测试, nodemailer, 连接测试, 超级管理员
   * English keywords: test email, SMTP verification, email sending, config test, nodemailer, connection test, super admin
   */
  public async sendTestEmail(
    targetEmail: string,
    smtpConfig?: SmtpConfigInput,
    operatorRole?: string,
  ): Promise<void> {
    if (operatorRole !== 'SUPER_ADMIN') {
      throw new Error('ERR_FORBIDDEN_SUPER_ADMIN_ONLY')
    }

    if (smtpConfig) {
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: smtpConfig.user ? { user: smtpConfig.user, pass: smtpConfig.pass } : undefined,
      })

      await transporter.sendMail({
        from: smtpConfig.from,
        to: targetEmail,
        subject: 'MyndBBS Test Email',
        text: 'This is a test email from MyndBBS. If you received this, your SMTP configuration is working correctly.',
        html: '<p>This is a test email from <strong>MyndBBS</strong>.</p><p>If you received this, your SMTP configuration is working correctly.</p>',
      })
    } else {
      const sender = new SmtpEmailSender()
      await sender.sendEmail({
        to: targetEmail,
        subject: 'MyndBBS Test Email',
        textBody:
          'This is a test email from MyndBBS. If you received this, your SMTP configuration is working correctly.',
        htmlBody:
          '<p>This is a test email from <strong>MyndBBS</strong>.</p><p>If you received this, your SMTP configuration is working correctly.</p>',
      })
    }
  }
}

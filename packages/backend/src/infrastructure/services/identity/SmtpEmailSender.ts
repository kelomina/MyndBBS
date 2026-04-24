import nodemailer, { type Transporter } from 'nodemailer';
import { APP_NAME } from '@myndbbs/shared';
import { type IEmailSender, type SendEmailCommand } from '../../../domain/identity/ports/IEmailSender';

/**
 * Callers: [Registry]
 * Callees: [nodemailer.createTransport, transporter.sendMail]
 * Description: Sends outbound mail through SMTP when configured, and falls back to a development-only JSON transport so local registration flows remain testable.
 * 描述：在已配置 SMTP 时通过 SMTP 发送邮件；未配置时回退到仅开发环境可用的 JSON 传输器，以便本地注册流程仍可测试。
 * Variables: `transporter` caches the initialized Nodemailer transporter, while environment variables provide SMTP host, port, credentials, and from address.
 * 变量：`transporter` 缓存初始化后的 Nodemailer 传输器；环境变量提供 SMTP 主机、端口、凭据和发件地址。
 * Integration: Register this adapter in the backend registry and inject it into `AuthApplicationService`.
 * 接入方式：在后端注册表中注册此适配器，并注入 `AuthApplicationService`。
 * Error Handling: Throws `ERR_EMAIL_DELIVERY_NOT_CONFIGURED` in production without SMTP settings and `ERR_EMAIL_DELIVERY_FAILED` when transport delivery fails.
 * 错误处理：生产环境缺少 SMTP 配置时抛出 `ERR_EMAIL_DELIVERY_NOT_CONFIGURED`，传输失败时抛出 `ERR_EMAIL_DELIVERY_FAILED`。
 * Keywords: smtp sender, nodemailer adapter, outbound verification email, development preview, identity infrastructure, SMTP发送器, Nodemailer适配器, 验证邮件, 开发预览, 身份基础设施
 */
export class SmtpEmailSender implements IEmailSender {
  private transporter: Transporter | null = null;

  /**
   * Callers: [SmtpEmailSender.sendEmail]
   * Callees: [nodemailer.createTransport]
   * Description: Lazily creates and caches the mail transporter so configuration is evaluated only when the application actually needs to send mail.
   * 描述：按需创建并缓存邮件传输器，只有应用真正需要发信时才解析配置。
   * Variables: The transporter configuration is derived from `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASS`.
   * 变量：传输器配置来自 `SMTP_HOST`、`SMTP_PORT`、`SMTP_SECURE`、`SMTP_USER` 和 `SMTP_PASS`。
   * Integration: This helper is intentionally private; all callers should use `sendEmail` instead of building transports directly.
   * 接入方式：该辅助方法保持私有；所有调用方应使用 `sendEmail`，而不是直接创建传输器。
   * Error Handling: Throws when production configuration is incomplete or when `SMTP_PORT` is invalid.
   * 错误处理：生产配置不完整或 `SMTP_PORT` 非法时会抛错。
   * Keywords: create transporter, lazy init, smtp config, cached adapter, nodemailer setup, 创建传输器, 延迟初始化, SMTP配置, 缓存适配器, Nodemailer设置
   */
  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const smtpHost = process.env.SMTP_HOST?.trim();
    const smtpFrom = process.env.SMTP_FROM?.trim();
    const rawPort = process.env.SMTP_PORT?.trim() ?? '587';
    const smtpPort = Number(rawPort);

    if (!Number.isFinite(smtpPort) || smtpPort <= 0) {
      throw new Error('ERR_EMAIL_DELIVERY_NOT_CONFIGURED');
    }

    if (smtpHost && smtpFrom) {
      const smtpSecure = process.env.SMTP_SECURE === 'true';
      const smtpUser = process.env.SMTP_USER?.trim();
      const smtpPass = process.env.SMTP_PASS?.trim();

      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: smtpUser ? { user: smtpUser, pass: smtpPass ?? '' } : undefined,
      });

      return this.transporter;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('ERR_EMAIL_DELIVERY_NOT_CONFIGURED');
    }

    this.transporter = nodemailer.createTransport({
      jsonTransport: true,
    });

    return this.transporter;
  }

  /**
   * Callers: [SmtpEmailSender.sendEmail]
   * Callees: []
   * Description: Resolves the `from` address for outbound emails, using configuration when available and a development-safe fallback otherwise.
   * 描述：解析出站邮件的发件地址，优先使用配置值，缺失时在开发环境回退到安全默认值。
   * Variables: `configuredFrom` is the explicit `SMTP_FROM` value, and the fallback address uses the application name for local previews.
   * 变量：`configuredFrom` 是显式的 `SMTP_FROM` 值，回退地址会在本地预览场景使用应用名。
   * Integration: Keep this logic private so all outbound mail shares the same sender identity policy.
   * 接入方式：保持此逻辑私有，让所有出站邮件共享同一发件人策略。
   * Error Handling: Falls back in development and throws the same configuration error path as the transporter in production.
   * 错误处理：开发环境自动回退，生产环境沿用与传输器相同的配置错误路径。
   * Keywords: from address, mail identity, development fallback, smtp sender, configuration helper, 发件地址, 邮件身份, 开发回退, SMTP发送器, 配置辅助
   */
  private getFromAddress(): string {
    const configuredFrom = process.env.SMTP_FROM?.trim();
    if (configuredFrom) {
      return configuredFrom;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('ERR_EMAIL_DELIVERY_NOT_CONFIGURED');
    }

    return `${APP_NAME} <no-reply@localhost>`;
  }

  /**
   * Callers: [AuthApplicationService.registerUser]
   * Callees: [SmtpEmailSender.getTransporter, SmtpEmailSender.getFromAddress, transporter.sendMail]
   * Description: Sends one outbound email message and emits a console preview in development when no real SMTP transport is configured.
   * 描述：发送一封出站邮件；若当前是开发环境且未配置真实 SMTP，会额外输出控制台预览。
   * Variables: `command` carries the typed email payload; `info` is the transport-layer result returned by Nodemailer.
   * 变量：`command` 携带强类型邮件载荷；`info` 是 Nodemailer 返回的传输结果。
   * Integration: The identity application service should pass fully rendered email content into this method.
   * 接入方式：身份应用服务应将渲染完成的邮件内容传给本方法。
   * Error Handling: Wraps Nodemailer exceptions into `ERR_EMAIL_DELIVERY_FAILED` so the controller layer can translate them consistently across registration and recovery flows.
   * 错误处理：将 Nodemailer 异常统一包装为 `ERR_EMAIL_DELIVERY_FAILED`，便于控制器层在注册和找回流程中一致翻译。
   * Keywords: send email, outbound delivery, verification mail, nodemailer send, development preview, 发送邮件, 出站投递, 验证邮件, Nodemailer发送, 开发预览
   */
  public async sendEmail(command: SendEmailCommand): Promise<void> {
    try {
      const transporter = this.getTransporter();
      const info = await transporter.sendMail({
        from: this.getFromAddress(),
        to: command.to,
        subject: command.subject,
        text: command.textBody,
        html: command.htmlBody,
      });

      if (!process.env.SMTP_HOST) {
        console.info('[Email Preview]', {
          envelope: info.envelope,
          to: command.to,
          subject: command.subject,
          textBody: command.textBody,
        });
      }
    } catch (error) {
      console.error('[Email Delivery Error]', error);
      throw new Error('ERR_EMAIL_DELIVERY_FAILED');
    }
  }
}

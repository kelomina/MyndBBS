export interface SendEmailCommand {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
}

/**
 * 接口名称：IEmailSender
 *
 * 函数作用：
 *   出站邮件发送端口接口——定义身份应用服务发送验证邮件的契约。
 * Purpose:
 *   Outbound email delivery port interface — defines the contract for sending verification emails.
 * Variables: `SendEmailCommand` encapsulates the recipient, subject, plain-text body, and HTML body for one outbound email.
 * 变量：`SendEmailCommand` 封装一次出站邮件的收件人、主题、纯文本正文与 HTML 正文。
 * Integration: Provide an infrastructure adapter such as SMTP and inject it into the registry where `AuthApplicationService` is composed.
 * 接入方式：提供例如 SMTP 的基础设施适配器，并在组合 `AuthApplicationService` 的注册表中完成注入。
 * Error Handling: Implementations should throw explicit infrastructure error codes when delivery is unavailable or fails.
 * 错误处理：当邮件投递不可用或失败时，实现类应抛出明确的基础设施错误码。
 * Keywords: email sender, outbound mail, smtp port, verification email, identity port, 邮件发送器, 出站邮件, SMTP端口, 验证邮件, 身份端口
 */
export interface IEmailSender {
  sendEmail(command: SendEmailCommand): Promise<void>;
}

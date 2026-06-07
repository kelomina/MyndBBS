export enum EmailTemplateType {
  REGISTRATION_VERIFICATION = 'REGISTRATION_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
  TEST = 'TEST',
}

export interface EmailTemplateProps {
  id: string;
  type: EmailTemplateType;
  subject: string;
  textBody: string;
  htmlBody: string;
  updatedAt: Date;
}

const ALLOWED_EMAIL_HTML_TAGS = new Set([
  'p',
  'br',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'a',
  'table',
  'tr',
  'td',
  'th',
  'thead',
  'tbody',
  'div',
  'span',
]);

const VOID_EMAIL_HTML_TAGS = new Set(['br']);
const ALLOWED_EMAIL_HREF_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeHref = (rawHref: string): string | null => {
  const decodedHref = rawHref.replace(/&amp;/g, '&').trim();
  if (!decodedHref) {
    return null;
  }

  if (/^{{[A-Za-z0-9_.-]+}}$/.test(decodedHref)) {
    return escapeHtml(decodedHref);
  }

  try {
    const parsed = new URL(decodedHref);
    if (!ALLOWED_EMAIL_HREF_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }
    return escapeHtml(decodedHref);
  } catch {
    if (decodedHref.startsWith('/') || decodedHref.startsWith('#')) {
      return escapeHtml(decodedHref);
    }
    return null;
  }
};

/**
 * Function name:
 *   sanitizeEmailTemplateHtml
 *
 * Purpose:
 *   Sanitizes stored and rendered email-template HTML with a strict allowlist so admin
 *   previews and outbound email bodies cannot retain scripts, event handlers, or unsafe URLs.
 *
 * Called by:
 *   EmailTemplate.create, EmailTemplate.restore, EmailTemplate.update, EmailTemplate.render.
 *
 * Calls:
 *   sanitizeHref, escapeHtml, URL.
 *
 * Parameters:
 *   - htmlBody: string, raw email HTML body, non-null, may contain template placeholders.
 *
 * Returns:
 *   string, sanitized HTML body. Disallowed tags and attributes are removed.
 *
 * Error handling:
 *   The sanitizer does not throw for malformed HTML; malformed or unsupported fragments are dropped.
 *
 * Side effects:
 *   None.
 *
 * Transaction boundary:
 *   None.
 *
 * Concurrency and idempotency:
 *   Pure and repeatable; sanitizing already sanitized HTML is safe.
 *
 * English keywords:
 *   email, template, html, sanitize, xss, script, href, allowlist, render, preview
 */
export const sanitizeEmailTemplateHtml = (htmlBody: string): string => {
  return htmlBody
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?\s*>/gi, '')
    .replace(/<\/?([a-zA-Z][\w:-]*)([^>]*)>/g, (fullMatch, rawTagName, rawAttributes) => {
      const tagName = String(rawTagName).toLowerCase();
      if (!ALLOWED_EMAIL_HTML_TAGS.has(tagName)) {
        return '';
      }

      if (fullMatch.startsWith('</')) {
        return VOID_EMAIL_HTML_TAGS.has(tagName) ? '' : `</${tagName}>`;
      }

      if (tagName !== 'a') {
        return `<${tagName}>`;
      }

      const hrefMatch = String(rawAttributes).match(/\s+href\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
      const href = hrefMatch ? sanitizeHref(hrefMatch[2] ?? hrefMatch[3] ?? hrefMatch[4] ?? '') : null;
      return href ? `<a href="${href}">` : '<a>';
    });
};

const sanitizeEmailTemplateProps = (props: EmailTemplateProps): EmailTemplateProps => ({
  ...props,
  htmlBody: sanitizeEmailTemplateHtml(props.htmlBody),
});

/**
 * 类名称：EmailTemplate
 *
 * 函数作用：
 *   邮件模板实体——封装邮件模板的创建、更新和变量渲染。
 * Purpose:
 *   Email template entity — encapsulates creation, update, and variable rendering of email templates.
 *
 * 中文关键词：
 *   邮件模板，实体，渲染
 * English keywords:
 *   email template, entity, render
 */
export class EmailTemplate {
  private props: EmailTemplateProps;

  /**
   * 函数名称：constructor（私有）
   *
   * 函数作用：
   *   私有构造函数，强制通过静态工厂方法实例化。
   * Purpose:
   *   Private constructor to enforce instantiation via static factory methods.
   */
  private constructor(props: EmailTemplateProps) {
    this.props = { ...props };
  }

  /**
   * 函数名称：create
   *
   * 函数作用：
   *   静态工厂方法——创建新的邮件模板，校验必填字段。
   * Purpose:
   *   Static factory method — creates a new email template, validates required fields.
   *
   * 参数说明 / Parameters:
   *   - props: EmailTemplateProps（type、subject、textBody、htmlBody 必填）
   *
   * 错误处理 / Error handling:
   *   - ERR_EMAIL_TEMPLATE_MISSING_REQUIRED_FIELDS（缺少必填字段）
   *
   * 中文关键词：
   创建邮件模板
   * English keywords:
   *   create email template
   */
  public static create(props: EmailTemplateProps): EmailTemplate {
    if (!props.type || !props.subject || !props.textBody || !props.htmlBody) {
      throw new Error('ERR_EMAIL_TEMPLATE_MISSING_REQUIRED_FIELDS');
    }
    return new EmailTemplate(sanitizeEmailTemplateProps(props));
  }

  public static restore(props: EmailTemplateProps): EmailTemplate {
    return new EmailTemplate(sanitizeEmailTemplateProps(props));
  }

  public get id(): string { return this.props.id; }
  public get type(): EmailTemplateType { return this.props.type; }
  public get subject(): string { return this.props.subject; }
  public get textBody(): string { return this.props.textBody; }
  public get htmlBody(): string { return this.props.htmlBody; }
  public get updatedAt(): Date { return this.props.updatedAt; }

  /**
   * 函数名称：update
   *
   * 函数作用：
   *   更新邮件模板的内容（主题、纯文本正文、HTML 正文）。
   * Purpose:
   *   Updates the email template content (subject, text body, HTML body).
   *
   * 参数说明 / Parameters:
   *   - subject: string, 新主题（必填）
   *   - textBody: string, 新纯文本正文（必填）
   *   - htmlBody: string, 新 HTML 正文（必填）
   *
   * 错误处理 / Error handling:
   *   - ERR_EMAIL_TEMPLATE_MISSING_REQUIRED_FIELDS（参数为空）
   *
   * 中文关键词：
   更新邮件模板
   * English keywords:
   *   update email template
   */
  public update(subject: string, textBody: string, htmlBody: string): void {
    if (!subject || !textBody || !htmlBody) {
      throw new Error('ERR_EMAIL_TEMPLATE_MISSING_REQUIRED_FIELDS');
    }
    this.props.subject = subject;
    this.props.textBody = textBody;
    this.props.htmlBody = sanitizeEmailTemplateHtml(htmlBody);
  }

  /**
   * 函数名称：render
   *
   * 函数作用：
   *   用传入的变量替换模板中的 {{varName}} 占位符，返回渲染后的结果。
   * Purpose:
   *   Replaces {{varName}} placeholders in the template with provided variables and returns the rendered result.
   *
   * 参数说明 / Parameters:
   *   - variables: Record<string, string>, 变量键值对
   *
   * 返回值说明 / Returns:
   *   { subject: string, textBody: string, htmlBody: string }
   *
   * 中文关键词：
   渲染模板，变量替换
   * English keywords:
   *   render template, variable substitution
   */
  public render(variables: Record<string, string>): { subject: string; textBody: string; htmlBody: string } {
    let subject = this.props.subject;
    let textBody = this.props.textBody;
    let htmlBody = this.props.htmlBody;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      subject = subject.split(placeholder).join(value);
      textBody = textBody.split(placeholder).join(value);
      htmlBody = htmlBody.split(placeholder).join(escapeHtml(value));
    }

    return { subject, textBody, htmlBody: sanitizeEmailTemplateHtml(htmlBody) };
  }
}

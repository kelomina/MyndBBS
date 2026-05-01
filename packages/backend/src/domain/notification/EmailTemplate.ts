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

export class EmailTemplate {
  private props: EmailTemplateProps;

  private constructor(props: EmailTemplateProps) {
    this.props = { ...props };
  }

  public static create(props: EmailTemplateProps): EmailTemplate {
    if (!props.type || !props.subject || !props.textBody || !props.htmlBody) {
      throw new Error('ERR_EMAIL_TEMPLATE_MISSING_REQUIRED_FIELDS');
    }
    return new EmailTemplate(props);
  }

  public static restore(props: EmailTemplateProps): EmailTemplate {
    return new EmailTemplate(props);
  }

  public get id(): string { return this.props.id; }
  public get type(): EmailTemplateType { return this.props.type; }
  public get subject(): string { return this.props.subject; }
  public get textBody(): string { return this.props.textBody; }
  public get htmlBody(): string { return this.props.htmlBody; }
  public get updatedAt(): Date { return this.props.updatedAt; }

  public update(subject: string, textBody: string, htmlBody: string): void {
    if (!subject || !textBody || !htmlBody) {
      throw new Error('ERR_EMAIL_TEMPLATE_MISSING_REQUIRED_FIELDS');
    }
    this.props.subject = subject;
    this.props.textBody = textBody;
    this.props.htmlBody = htmlBody;
  }

  public render(variables: Record<string, string>): { subject: string; textBody: string; htmlBody: string } {
    let subject = this.props.subject;
    let textBody = this.props.textBody;
    let htmlBody = this.props.htmlBody;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      subject = subject.split(placeholder).join(value);
      textBody = textBody.split(placeholder).join(value);
      htmlBody = htmlBody.split(placeholder).join(value);
    }

    return { subject, textBody, htmlBody };
  }
}

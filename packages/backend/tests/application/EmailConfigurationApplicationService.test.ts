import {
  EmailConfigurationApplicationService,
  validateSmtpHostForOutboundConnection,
} from '../../src/application/notification/EmailConfigurationApplicationService';
import { IEnvStore, SmtpConfigInput } from '../../src/domain/provisioning/IEnvStore';
import { IEmailTemplateRepository } from '../../src/domain/notification/IEmailTemplateRepository';
import { EmailTemplate, EmailTemplateType } from '../../src/domain/notification/EmailTemplate';

describe('EmailConfigurationApplicationService', () => {
  let envStore: jest.Mocked<IEnvStore>;
  let templateRepository: jest.Mocked<IEmailTemplateRepository>;
  let service: EmailConfigurationApplicationService;

  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;

    envStore = {
      setupEnvironment: jest.fn(),
      updateDatabaseUrl: jest.fn(),
      updateDomainConfig: jest.fn(),
      updateSmtpConfig: jest.fn(),
      read: jest.fn(),
      write: jest.fn(),
    } as any;
    templateRepository = {
      findByType: jest.fn(),
      findAll: jest.fn(),
      upsert: jest.fn(),
    } as any;

    service = new EmailConfigurationApplicationService({
      envStore,
      emailTemplateRepository: templateRepository,
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getSmtpConfig', () => {
    it('should throw if not SUPER_ADMIN', () => {
      expect(() => service.getSmtpConfig('USER')).toThrow('ERR_FORBIDDEN_SUPER_ADMIN_ONLY');
    });

    it('should return SMTP config from environment', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_SECURE = 'false';
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'pass';
      process.env.SMTP_FROM = 'test@example.com';

      const config = service.getSmtpConfig('SUPER_ADMIN');
      expect(config).toEqual({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        user: 'user',
        pass: 'pass',
        from: 'test@example.com',
      });
    });

    it('should return defaults for missing env vars', () => {
      const config = service.getSmtpConfig('SUPER_ADMIN');
      expect(config).toEqual({
        host: '',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        from: '',
      });
    });
  });

  describe('updateSmtpConfig', () => {
    it('should throw if not SUPER_ADMIN', async () => {
      await expect(service.updateSmtpConfig({} as SmtpConfigInput, 'USER')).rejects.toThrow('ERR_FORBIDDEN_SUPER_ADMIN_ONLY');
    });

    it('should call envStore.updateSmtpConfig', async () => {
      const config: SmtpConfigInput = { host: 'smtp.example.com', port: 465, secure: true, user: 'u', pass: 'p', from: 'f@e.com' };
      await service.updateSmtpConfig(config, 'SUPER_ADMIN');
      expect(envStore.updateSmtpConfig).toHaveBeenCalledWith(config);
    });

    it.each([
      'localhost',
      '127.0.0.1',
      '::1',
      '10.0.0.1',
      '172.16.0.1',
      '192.168.1.1',
      '169.254.169.254',
    ])('should reject blocked SMTP host %s', async (host) => {
      const config: SmtpConfigInput = { host, port: 465, secure: true, user: 'u', pass: 'p', from: 'f@e.com' };
      await expect(service.updateSmtpConfig(config, 'SUPER_ADMIN')).rejects.toThrow('ERR_SMTP_HOST_NOT_ALLOWED');
      expect(envStore.updateSmtpConfig).not.toHaveBeenCalled();
    });

    it('should allow public SMTP domain names', () => {
      expect(() => validateSmtpHostForOutboundConnection('smtp.example.com')).not.toThrow();
    });

    it('should not treat public domains starting with IPv6 private prefixes as IP literals', () => {
      expect(() => validateSmtpHostForOutboundConnection('fcdn.example.com')).not.toThrow();
    });
  });

  describe('sendTestEmail', () => {
    it('should reject blocked temporary SMTP config before creating a transport', async () => {
      const config: SmtpConfigInput = { host: '127.0.0.1', port: 25, secure: false, user: '', pass: '', from: 'f@e.com' };
      await expect(service.sendTestEmail('target@example.com', config, 'SUPER_ADMIN')).rejects.toThrow('ERR_SMTP_HOST_NOT_ALLOWED');
    });

    it('should reject blocked saved SMTP host before using saved sender', async () => {
      process.env.SMTP_HOST = '169.254.169.254';
      await expect(service.sendTestEmail('target@example.com', undefined, 'SUPER_ADMIN')).rejects.toThrow('ERR_SMTP_HOST_NOT_ALLOWED');
    });
  });

  describe('getEmailTemplates', () => {
    it('should throw if not SUPER_ADMIN', async () => {
      await expect(service.getEmailTemplates('USER')).rejects.toThrow('ERR_FORBIDDEN_SUPER_ADMIN_ONLY');
    });

    it('should return default templates when DB is empty', async () => {
      templateRepository.findAll.mockResolvedValue([]);
      const templates = await service.getEmailTemplates('SUPER_ADMIN');
      expect(templates).toHaveLength(3);
      const reg = templates.find((t) => t.type === EmailTemplateType.REGISTRATION_VERIFICATION);
      expect(reg).toBeDefined();
      expect(reg!.subject).toContain('{{appName}}');
    });

    it('should return saved templates when they exist', async () => {
      const savedTemplate = EmailTemplate.create({
        id: 'test-id',
        type: EmailTemplateType.REGISTRATION_VERIFICATION,
        subject: 'Custom Subject',
        textBody: 'Custom text',
        htmlBody: '<p>Custom HTML</p>',
        updatedAt: new Date(),
      });
      templateRepository.findAll.mockResolvedValue([savedTemplate]);
      const templates = await service.getEmailTemplates('SUPER_ADMIN');
      const reg = templates.find((t) => t.type === EmailTemplateType.REGISTRATION_VERIFICATION);
      expect(reg).toBeDefined();
      expect(reg!.subject).toBe('Custom Subject');
    });
  });

  describe('updateEmailTemplate', () => {
    it('should throw if not SUPER_ADMIN', async () => {
      await expect(service.updateEmailTemplate(EmailTemplateType.REGISTRATION_VERIFICATION, 's', 't', 'h', 'USER')).rejects.toThrow('ERR_FORBIDDEN_SUPER_ADMIN_ONLY');
    });

    it('should upsert the template', async () => {
      templateRepository.findAll.mockResolvedValue([]);
      await service.updateEmailTemplate(EmailTemplateType.REGISTRATION_VERIFICATION, 'Subject', 'Text', '<p>HTML</p>', 'SUPER_ADMIN');
      expect(templateRepository.upsert).toHaveBeenCalledTimes(1);
    });
  });
});

describe('EmailTemplate domain entity', () => {
  it('should throw on empty subject', () => {
    expect(() => EmailTemplate.create({
      id: 'id',
      type: EmailTemplateType.TEST,
      subject: '',
      textBody: 'text',
      htmlBody: '<p>html</p>',
      updatedAt: new Date(),
    })).toThrow('ERR_EMAIL_TEMPLATE_MISSING_REQUIRED_FIELDS');
  });

  it('should render variables in template', () => {
    const tpl = EmailTemplate.create({
      id: 'id',
      type: EmailTemplateType.TEST,
      subject: 'Hello {{name}}',
      textBody: 'Hi {{name}}',
      htmlBody: '<p>Hi {{name}}</p>',
      updatedAt: new Date(),
    });
    const result = tpl.render({ name: 'World' });
    expect(result.subject).toBe('Hello World');
    expect(result.textBody).toBe('Hi World');
    expect(result.htmlBody).toBe('<p>Hi World</p>');
  });

  it('should sanitize dangerous HTML when created, updated, and rendered', () => {
    const tpl = EmailTemplate.create({
      id: 'id',
      type: EmailTemplateType.TEST,
      subject: 'Hello {{name}}',
      textBody: 'Hi {{name}}',
      htmlBody:
        '<p onclick="evil()">Hi {{name}}</p><script>alert(1)</script><a href="javascript:alert(1)">bad</a><strong>safe</strong>',
      updatedAt: new Date(),
    });

    expect(tpl.htmlBody).not.toContain('script');
    expect(tpl.htmlBody).not.toContain('onclick');
    expect(tpl.htmlBody).not.toContain('javascript:');
    expect(tpl.htmlBody).toContain('<strong>safe</strong>');

    const rendered = tpl.render({ name: '<img src=x onerror=alert(1)>' });
    expect(rendered.htmlBody).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(rendered.htmlBody).not.toContain('<img');

    tpl.update('Updated', 'Updated text', '<div><span onmouseover="evil()">ok</span><a href="https://example.com">link</a></div>');
    expect(tpl.htmlBody).toBe('<div><span>ok</span><a href="https://example.com">link</a></div>');
  });

  it('should preserve href placeholders and sanitize them after rendering', () => {
    const tpl = EmailTemplate.create({
      id: 'id',
      type: EmailTemplateType.REGISTRATION_VERIFICATION,
      subject: 'Verify',
      textBody: '{{verificationLink}}',
      htmlBody: '<p><a href="{{verificationLink}}">{{verificationLink}}</a></p>',
      updatedAt: new Date(),
    });

    expect(tpl.htmlBody).toBe('<p><a href="{{verificationLink}}">{{verificationLink}}</a></p>');
    expect(tpl.render({ verificationLink: 'https://example.com/verify' }).htmlBody).toBe(
      '<p><a href="https://example.com/verify">https://example.com/verify</a></p>',
    );
    expect(tpl.render({ verificationLink: 'javascript:alert(1)' }).htmlBody).toBe(
      '<p><a>javascript:alert(1)</a></p>',
    );
  });

  it('should update content', () => {
    const tpl = EmailTemplate.create({
      id: 'id',
      type: EmailTemplateType.TEST,
      subject: 'Old',
      textBody: 'Old text',
      htmlBody: '<p>Old html</p>',
      updatedAt: new Date(),
    });
    tpl.update('New', 'New text', '<p>New html</p>');
    expect(tpl.subject).toBe('New');
    expect(tpl.textBody).toBe('New text');
    expect(tpl.htmlBody).toBe('<p>New html</p>');
  });
});

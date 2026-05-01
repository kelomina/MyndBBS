import { EmailConfigurationApplicationService } from '../../src/application/notification/EmailConfigurationApplicationService';
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

    service = new EmailConfigurationApplicationService(envStore, templateRepository);
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

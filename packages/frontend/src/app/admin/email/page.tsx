'use client';
import { useTranslation } from '../../../components/TranslationProvider';
import { useToast } from '../../../components/ui/Toast';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Eye, EyeOff } from 'lucide-react';
import { getEmailConfig, updateEmailConfig, updateEmailTemplate, sendTestEmail } from '../../../lib/api/admin';

type Tab = 'smtp' | 'templates' | 'test';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

interface EmailTemplateItem {
  type: string;
  subject: string;
  textBody: string;
  htmlBody: string;
}

const TEMPLATE_TYPE_LABELS: Record<string, { en: string; zh: string }> = {
  REGISTRATION_VERIFICATION: { en: 'Registration Verification', zh: '注册验证' },
  PASSWORD_RESET: { en: 'Password Reset', zh: '密码重置' },
  TEST: { en: 'Test Email', zh: '测试邮件' },
};

export default function EmailConfigPage() {
  const dict = useTranslation();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('smtp');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig>({
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from: '',
  });

  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [selectedTemplateType, setSelectedTemplateType] = useState<string>('REGISTRATION_VERIFICATION');
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const apiErrors = dict.apiErrors as unknown as Record<string, string | undefined>;
  const t = (key: string, fallback: string) => {
    const admin = dict.admin as unknown as Record<string, string | undefined>;
    return admin?.[key] || fallback;
  };

  const loadData = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const data = await getEmailConfig();
      setSmtpConfig(data.smtpConfig);
      setTemplates(data.templates);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => { window.clearTimeout(timerId); };
  }, [loadData]);

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      await updateEmailConfig(smtpConfig);
      setSuccess(t('emailSaveSuccess', 'Email configuration saved. The server is restarting to apply changes.'));
      toast(t('emailSaveSuccess', 'Email configuration saved.'), 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      setError(apiErrors?.[msg] || msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSendingTest(true);
      setError('');
      setSuccess('');
      await sendTestEmail(testEmail, smtpConfig);
      setSuccess(t('emailTestSuccess', 'Test email sent successfully.'));
      toast(t('emailTestSuccess', 'Test email sent.'), 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send test email';
      setError(apiErrors?.[msg] || msg);
    } finally {
      setSendingTest(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'smtp', label: t('emailSmtpConfig', 'SMTP Configuration') },
    { key: 'templates', label: t('emailTemplates', 'Email Templates') },
    { key: 'test', label: t('emailTestSend', 'Send Test') },
  ];

  if (loading) return <div className="p-8 text-center text-muted">{dict.common?.loading || 'Loading...'}</div>;

  const currentTemplate = templates.find((t) => t.type === selectedTemplateType) || {
    type: selectedTemplateType as string,
    subject: '',
    textBody: '',
    htmlBody: '',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('emailConfigTitle', 'Email Configuration')}</h1>
        <p className="text-muted">{t('emailConfigDesc', 'Configure SMTP settings and manage email templates. Only SUPER_ADMIN can access this.')}</p>
      </div>

      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/50 dark:text-red-200">{error}</div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-600 dark:bg-green-900/50 dark:text-green-200">{success}</div>
      )}

      {activeTab === 'smtp' && (
        <form onSubmit={handleSaveSmtp} className="max-w-2xl space-y-6 rounded-md border border-border bg-card p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('emailHost', 'SMTP Host')}</label>
              <input
                required
                type="text"
                value={smtpConfig.host}
                onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="smtp.example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('emailPort', 'SMTP Port')}</label>
              <input
                required
                type="number"
                value={smtpConfig.port}
                onChange={(e) => setSmtpConfig({ ...smtpConfig, port: Number(e.target.value) })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="secure"
              checked={smtpConfig.secure}
              onChange={(e) => setSmtpConfig({ ...smtpConfig, secure: e.target.checked })}
              className="rounded border-input"
            />
            <label htmlFor="secure" className="text-sm font-medium">{t('emailSecure', 'Use SSL/TLS (Secure)')}</label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('emailUser', 'SMTP Username')}</label>
              <input
                type="text"
                value={smtpConfig.user}
                onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('emailPass', 'SMTP Password')}</label>
              <input
                type="password"
                value={smtpConfig.pass}
                onChange={(e) => setSmtpConfig({ ...smtpConfig, pass: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('emailFrom', 'Sender Address')}</label>
            <input
              required
              type="email"
              value={smtpConfig.from}
              onChange={(e) => setSmtpConfig({ ...smtpConfig, from: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="MyndBBS <no-reply@example.com>"
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={saving}>
              {saving ? (dict.settings?.saving || 'Saving...') : (dict.settings?.saveChanges || 'Save Changes')}
            </Button>
          </div>
        </form>
      )}

      {activeTab === 'templates' && (
        <div className="max-w-2xl space-y-6">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium">{t('emailTemplateType', 'Template Type')}</label>
            <select
              value={selectedTemplateType}
              onChange={(e) => setSelectedTemplateType(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {templates.map((tpl) => {
                const label = TEMPLATE_TYPE_LABELS[tpl.type];
                return (
                  <option key={tpl.type} value={tpl.type}>
                    {label ? `${label.en} / ${label.zh}` : tpl.type}
                  </option>
                );
              })}
            </select>
          </div>

          <TemplateForm
            key={selectedTemplateType + JSON.stringify(templates.map(t => t.subject))}
            template={currentTemplate}
            onSave={async (subject, textBody, htmlBody) => {
              try {
                setSaving(true);
                setError('');
                setSuccess('');
                await updateEmailTemplate({ type: selectedTemplateType, subject, textBody, htmlBody });
                setSuccess(t('emailTemplateSaveSuccess', 'Email template updated successfully.'));
                toast(t('emailTemplateSaveSuccess', 'Template updated.'), 'success');
                await loadData();
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Failed to save template';
                setError(apiErrors?.[msg] || msg);
              } finally {
                setSaving(false);
              }
            }}
            saving={saving}
            t={t}
          />
        </div>
      )}

      {activeTab === 'test' && (
        <form onSubmit={handleSendTest} className="max-w-lg space-y-6 rounded-md border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            {t('emailTestDesc', 'Send a test email to verify your SMTP configuration. The email will be sent using the current form values.')}
          </p>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('emailTestTarget', 'Target Email Address')}</label>
            <input
              required
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="user@example.com"
            />
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={sendingTest}>
              {sendingTest ? (t('emailTestSending', 'Sending...') || 'Sending...') : (t('emailTestSend', 'Send Test Email') || 'Send Test Email')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))].filter(Boolean);
}

const DEFAULT_VAR_VALUES: Record<string, string> = {
  appName: 'MyndBBS',
  username: 'JohnDoe',
  verificationLink: 'https://example.com/verify?token=demo-token',
  resetLink: 'https://example.com/reset?token=demo-token',
  expiresInMinutes: '30',
};

function TemplateForm({
  template,
  onSave,
  saving,
  t,
}: {
  template: EmailTemplateItem;
  onSave: (subject: string, textBody: string, htmlBody: string) => Promise<void>;
  saving: boolean;
  t: (key: string, fallback: string) => string;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [textBody, setTextBody] = useState(template.textBody);
  const [htmlBody, setHtmlBody] = useState(template.htmlBody);
  const [showPreview, setShowPreview] = useState(false);

  const allVariables = useMemo(() => {
    const vars = new Set<string>();
    for (const v of extractVariables(subject)) vars.add(v);
    for (const v of extractVariables(textBody)) vars.add(v);
    for (const v of extractVariables(htmlBody)) vars.add(v);
    return [...vars];
  }, [subject, textBody, htmlBody]);

  const [varValues, setVarValues] = useState<Record<string, string>>(() => {
    const result: Record<string, string> = {};
    for (const v of allVariables) {
      result[v] = DEFAULT_VAR_VALUES[v] || `{{${v}}}`;
    }
    return result;
  });

  const effectiveVarValues = useMemo(() => {
    const result = { ...varValues };
    for (const v of allVariables) {
      if (!(v in result)) {
        result[v] = DEFAULT_VAR_VALUES[v] || `{{${v}}}`;
      }
    }
    for (const v of Object.keys(result)) {
      if (!allVariables.includes(v)) {
        delete result[v];
      }
    }
    return result;
  }, [allVariables, varValues]);

  const preview = useMemo(() => {
    let renderedSubject = subject;
    let renderedText = textBody;
    let renderedHtml = htmlBody;
    for (const [key, value] of Object.entries(effectiveVarValues)) {
      const ph = `{{${key}}}`;
      renderedSubject = renderedSubject.split(ph).join(value);
      renderedText = renderedText.split(ph).join(value);
      renderedHtml = renderedHtml.split(ph).join(value);
    }
    return { subject: renderedSubject, textBody: renderedText, htmlBody: renderedHtml };
  }, [subject, textBody, htmlBody, effectiveVarValues]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(subject, textBody, htmlBody);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-border bg-card p-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('emailTemplateSubject', 'Subject')}</label>
        <input
          required
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('emailTemplateTextBody', 'Plain Text Body')}</label>
        <textarea
          required
          rows={6}
          value={textBody}
          onChange={(e) => setTextBody(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('emailTemplateHtmlBody', 'HTML Body')}</label>
        <textarea
          required
          rows={8}
          value={htmlBody}
          onChange={(e) => setHtmlBody(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
        />
      </div>
      <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
        <p className="font-medium mb-1">{t('emailTemplateVariables', 'Available Variables')}</p>
        <code className="text-xs">
          {'{{appName}}'} {'{{username}}'} {'{{verificationLink}}'} {'{{resetLink}}'} {'{{expiresInMinutes}}'}
        </code>
      </div>

      <div className="border-t border-border pt-4">
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center space-x-2 text-sm font-medium text-primary hover:text-primary/80"
        >
          {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <span>{t('emailPreview', 'Preview') || 'Preview'}</span>
        </button>
      </div>

      {showPreview && (
        <div className="space-y-4 rounded-md border border-border bg-muted/30 p-4">
          {allVariables.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{t('emailPreviewVariables', 'Preview Variables')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {allVariables.map((v) => (
                  <div key={v} className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{`{{${v}}}`}</label>
                    <input
                      type="text"
                      value={effectiveVarValues[v] || ''}
                      onChange={(e) => setVarValues((prev) => ({ ...prev, [v]: e.target.value }))}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <p className="text-sm font-medium">{t('emailPreview', 'Preview')}</p>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{t('emailPreviewSubject', 'Rendered Subject')}</p>
              <div className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                {preview.subject}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{t('emailPreviewTextBody', 'Rendered Text Body')}</p>
              <pre className="rounded-md border border-border bg-background px-3 py-2 text-sm font-mono whitespace-pre-wrap">
                {preview.textBody}
              </pre>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{t('emailPreviewHtmlBody', 'Rendered HTML Body')}</p>
              <div className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                <div dangerouslySetInnerHTML={{ __html: preview.htmlBody }} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}

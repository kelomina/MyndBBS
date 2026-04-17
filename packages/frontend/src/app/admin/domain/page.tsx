'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../../components/TranslationProvider';
import { Button } from '../../../components/ui/Button';
import { getDomainConfig, updateDomainConfig } from '../../../lib/api/admin';

type DomainConfig = {
  protocol: 'http' | 'https';
  hostname: string;
  rpId: string;
  reverseProxyMode: boolean;
};

export default function DomainConfigPage() {
  const dict = useTranslation();
  const [config, setConfig] = useState<DomainConfig>({
    protocol: 'https',
    hostname: 'localhost',
    rpId: 'localhost',
    reverseProxyMode: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getDomainConfig();
        setConfig({
          protocol: data.protocol === 'https' ? 'https' : 'http',
          hostname: data.hostname || 'localhost',
          rpId: data.rpId || 'localhost',
          reverseProxyMode: !!data.reverseProxyMode,
        });
        setError('');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load config');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      await updateDomainConfig(config);
      setSuccess(dict.admin.domainSaveSuccess || 'Settings saved. The service is restarting to apply changes.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save config';
      const apiErrors = dict.apiErrors as unknown as Record<string, string | undefined>;
      setError(apiErrors?.[msg] || msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted">{dict.common?.loading || 'Loading...'}</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{dict.admin.domainConfigTitle}</h1>
        <p className="text-muted">{dict.admin.domainConfigDesc}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-md border border-border bg-card p-6">
        {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/50 dark:text-red-200">{error}</div>}
        {success && <div className="rounded-md bg-green-50 p-4 text-sm text-green-600 dark:bg-green-900/50 dark:text-green-200">{success}</div>}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">{dict.admin.domainProtocol}</label>
            <select
              value={config.protocol}
              onChange={(e) => setConfig({ ...config, protocol: e.target.value === 'https' ? 'https' : 'http' })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="https">https</option>
              <option value="http">http</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{dict.admin.domainHostname}</label>
            <input
              required
              type="text"
              value={config.hostname}
              onChange={(e) => setConfig({ ...config, hostname: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="localhost / ::1 / bbs.example.com"
            />
            <div className="text-xs text-muted">{dict.admin.domainHostnameHint}</div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">{dict.admin.domainRpId}</label>
            <input
              required
              type="text"
              value={config.rpId}
              onChange={(e) => setConfig({ ...config, rpId: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="localhost / example.com / ::1"
            />
            <div className="text-xs text-muted">{dict.admin.domainRpIdHint}</div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{dict.admin.domainTrustProxyMode}</label>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                checked={config.reverseProxyMode}
                onChange={(e) => setConfig({ ...config, reverseProxyMode: e.target.checked })}
              />
              <span className="text-sm text-muted">{dict.admin.domainTrustProxyModeDesc}</span>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border bg-background p-3 text-sm text-muted">
          {dict.admin.domainTrustProxyHint}
        </div>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={saving}>
            {saving ? dict.settings?.saving || 'Saving...' : dict.admin.domainSaveAndRestart}
          </Button>
        </div>
      </form>
    </div>
  );
}

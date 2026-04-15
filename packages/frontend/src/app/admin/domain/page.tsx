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
      setSuccess('配置已保存，服务正在重启以应用变更。');
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
        <h1 className="text-2xl font-bold tracking-tight">域名与 Passkey 配置</h1>
        <p className="text-muted">仅 SUPER_ADMIN 可修改。保存后后端将重启。</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-md border border-border bg-card p-6">
        {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/50 dark:text-red-200">{error}</div>}
        {success && <div className="rounded-md bg-green-50 p-4 text-sm text-green-600 dark:bg-green-900/50 dark:text-green-200">{success}</div>}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">协议</label>
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
            <label className="text-sm font-medium">hostname</label>
            <input
              required
              type="text"
              value={config.hostname}
              onChange={(e) => setConfig({ ...config, hostname: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="localhost / ::1 / bbs.example.com"
            />
            <div className="text-xs text-muted">不支持 IPv4，支持 localhost 与 IPv6（裸 ::1）。</div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">RP_ID</label>
            <input
              required
              type="text"
              value={config.rpId}
              onChange={(e) => setConfig({ ...config, rpId: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="localhost / example.com / ::1"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">使用反代模式</label>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                checked={config.reverseProxyMode}
                onChange={(e) => setConfig({ ...config, reverseProxyMode: e.target.checked })}
              />
              <span className="text-sm text-muted">开启后写入 TRUST_PROXY=true</span>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border bg-background p-3 text-sm text-muted">
          反代模式提示：请在反向代理转发 X-Forwarded-Proto / X-Forwarded-Host，否则后端无法正确识别 HTTPS，Cookie secure 与 WebAuthn 验证可能异常。
        </div>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={saving}>
            {saving ? dict.settings?.saving || 'Saving...' : '保存并重启'}
          </Button>
        </div>
      </form>
    </div>
  );
}

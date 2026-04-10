'use client';
import { useTranslation } from '../../../components/TranslationProvider';
import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { getDbConfig, updateDbConfig } from '../../../lib/api/admin';

export default function DatabaseConfigPage() {
  const dict = useTranslation();
  const [config, setConfig] = useState({
    host: '',
    port: 5432,
    username: '',
    password: '',
    database: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getDbConfig();
      setConfig(data);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      await updateDbConfig(config);
      setSuccess(dict.admin?.dbSaveSuccess || "Database configuration saved. The server is restarting to apply changes.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save database config';
      setError((dict.apiErrors as any)?.[msg] || msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted">{dict.common?.loading || "Loading..."}</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{dict.admin?.database || "Database Config"}</h1>
        <p className="text-muted">{dict.admin?.dbConfigDesc || "Configure PostgreSQL database connection settings. The system will test the connection and restart upon saving. Only SUPER_ADMIN can access this."}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-md border border-border bg-card p-6">
        {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/50 dark:text-red-200">{error}</div>}
        {success && <div className="rounded-md bg-green-50 p-4 text-sm text-green-600 dark:bg-green-900/50 dark:text-green-200">{success}</div>}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">{dict.admin?.dbHost || "Host"}</label>
            <input
              required
              type="text"
              value={config.host}
              onChange={(e) => setConfig({ ...config, host: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{dict.admin?.dbPort || "Port"}</label>
            <input
              required
              type="number"
              value={config.port}
              onChange={(e) => setConfig({ ...config, port: Number(e.target.value) })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">{dict.admin?.dbUser || "Username"}</label>
            <input
              required
              type="text"
              value={config.username}
              onChange={(e) => setConfig({ ...config, username: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{dict.admin?.dbPass || "Password"}</label>
            <input
              type="password"
              value={config.password}
              onChange={(e) => setConfig({ ...config, password: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">{dict.admin?.dbName || "Database Name"}</label>
          <input
            required
            type="text"
            value={config.database}
            onChange={(e) => setConfig({ ...config, database: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={saving}>
            {saving ? dict.settings?.saving || "Saving..." : dict.settings?.saveChanges || "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
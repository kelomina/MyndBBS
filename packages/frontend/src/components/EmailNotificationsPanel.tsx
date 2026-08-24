'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from './TranslationProvider';
import { useToast } from './ui/Toast';
import { fetchWithAuth } from '../lib/api/fetcher';

/**
 * 邮件通知开关面板（Phase 3 G8）：控制被回复/被提及等事件的邮件提醒。
 */
export function EmailNotificationsPanel() {
  const dict = useTranslation();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWithAuth('/api/v1/user/profile')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.user?.emailNotificationsEnabled === 'boolean') {
          setEnabled(data.user.emailNotificationsEnabled);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async () => {
    const next = !enabled;
    try {
      setSaving(true);
      const res = await fetchWithAuth('/api/v1/user/notification-preferences', {
        method: 'PUT',
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json();
      setEnabled(data.enabled ?? next);
      toast(dict.settings?.emailPrefSaved || 'Notification preferences saved', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      toast(msg || dict.settings?.emailPrefFailed || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted">{dict.common?.loading || 'Loading...'}</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">
        {dict.settings?.emailNotifications || 'Email notifications'}
      </h2>
      <p className="text-sm text-muted">
        {dict.settings?.emailNotificationsDesc ||
          'Receive an email when someone replies to your posts or comments, or mentions you.'}
      </p>

      <button
        onClick={() => void handleToggle()}
        disabled={saving}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
          enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
        }`}
        role="switch"
        aria-checked={enabled}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <span className="ml-3 text-sm font-medium">{enabled ? 'ON' : 'OFF'}</span>
    </div>
  );
}

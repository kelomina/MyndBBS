'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import {
  type CookiePreferences,
  DEFAULT_COOKIE_PREFERENCES,
  reconcileCookiePreferences,
  saveCookiePreferences,
} from '@/lib/cookiePreferences';
import { useTranslation } from './TranslationProvider';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';

/**
 * Callers: [SettingsPage]
 * Callees: [useTranslation, useToast, reconcileCookiePreferences, saveCookiePreferences]
 * Description: Renders the account-facing privacy settings page, loading and saving cookie preferences through the shared reconciliation module.
 * 描述：渲染面向账号的隐私设置页，并通过共享对账模块加载和保存 Cookie 偏好。
 * Variables: `preferences` 表示当前编辑中的偏好；`loading` 表示首屏加载状态；`saving` 表示保存中状态；`toast` 表示通知出口。
 * 变量：`preferences` 表示当前编辑中的偏好；`loading` 表示首屏加载状态；`saving` 表示保存中状态；`toast` 表示通知出口。
 * Integration: Render this component inside the settings page privacy tab so profile management and consent modal share the same storage and account-sync flow.
 * 接入方式：把本组件放在设置页的隐私标签中，让账号管理和同意弹窗共用同一条存储与账号同步链路。
 * Error Handling: Falls back to default preferences on load failures and surfaces save failures through toast while still preserving local persistence.
 * 错误处理：加载失败时回退到默认偏好；保存失败时通过 toast 告知用户，同时仍保留本地持久化结果。
 * Keywords: privacy settings, cookie preferences, shared module, account sync, legal links, 隐私设置, Cookie 偏好, 共享模块, 账号同步, 法律链接
 */
export const PrivacySettings = () => {
  const dict = useTranslation();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<CookiePreferences>(DEFAULT_COOKIE_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadPreferences = async () => {
      try {
        const result = await reconcileCookiePreferences();
        if (!isMounted) {
          return;
        }

        setPreferences(result.preferences ?? DEFAULT_COOKIE_PREFERENCES);
      } catch (error) {
        console.error('Failed to load preferences', error);
        if (!isMounted) {
          return;
        }

        setPreferences(DEFAULT_COOKIE_PREFERENCES);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPreferences();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);

    try {
      const saved = await saveCookiePreferences(preferences);
      if (!saved) {
        throw new Error('ERR_COOKIE_PREFERENCES_SYNC_FAILED');
      }

      toast(dict.profile?.preferencesSaved || 'Preferences saved successfully!', 'success');
    } catch {
      toast(dict.profile?.preferencesSaveError || 'Failed to save preferences.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border bg-muted/20">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            {dict.profile?.privacyOptions || 'Privacy & Cookie Preferences'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {dict.consent?.description || 'Manage your cookie preferences. These preferences will sync with your account.'}
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/10">
            <div>
              <h3 className="font-medium text-foreground">{dict.consent?.essential || 'Essential Cookies'}</h3>
              <p className="text-sm text-muted-foreground mt-1">{dict.consent?.essentialDesc || 'Required for the website to function properly.'}</p>
            </div>
            <input type="checkbox" checked disabled className="w-5 h-5 accent-primary cursor-not-allowed opacity-50" />
          </div>

          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div>
              <h3 className="font-medium text-foreground">{dict.consent?.analytics || 'Analytics Cookies'}</h3>
              <p className="text-sm text-muted-foreground mt-1">{dict.consent?.analyticsDesc || 'Help us understand how visitors interact with the website.'}</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.analytics}
              onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
              className="w-5 h-5 accent-primary cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div>
              <h3 className="font-medium text-foreground">{dict.consent?.marketing || 'Marketing Cookies'}</h3>
              <p className="text-sm text-muted-foreground mt-1">{dict.consent?.marketingDesc || 'Used to deliver relevant advertisements.'}</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.marketing}
              onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
              className="w-5 h-5 accent-primary cursor-pointer"
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (dict.common?.save || 'Saving...') : (dict.consent?.savePreferences || 'Save Preferences')}
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border bg-muted/20">
          <h2 className="text-xl font-semibold text-foreground">
            {dict.profile?.legalDocuments || 'Legal Documents'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {dict.profile?.legalDesc || 'Review our terms of service and privacy policy.'}
          </p>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <Link href="/terms" className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors group">
            <span className="font-medium text-foreground">{dict.consent?.terms || 'Terms of Service'}</span>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
          </Link>
          <Link href="/privacy" className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors group">
            <span className="font-medium text-foreground">{dict.consent?.privacy || 'Privacy Policy'}</span>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
          </Link>
        </div>
      </div>
    </div>
  );
};

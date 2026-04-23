'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  type CookiePreferences,
  DEFAULT_COOKIE_PREFERENCES,
  reconcileCookiePreferences,
  saveCookiePreferences,
} from '@/lib/cookiePreferences';
import { useTranslation } from './TranslationProvider';
import { Button } from './ui/Button';

/**
 * Callers: [RootLayout]
 * Callees: [useTranslation, reconcileCookiePreferences, saveCookiePreferences]
 * Description: Reconciles cookie consent between device storage and the signed-in account, then renders the consent modal only when no valid preference exists.
 * 描述：在设备本地存储与登录账号之间对账 Cookie 同意状态，并且仅在没有有效偏好时渲染同意弹窗。
 * Variables: `isOpen` 控制弹窗开关；`preferences` 保存当前偏好；`dict` 提供多语言文案；`isMounted` 防止卸载后继续写状态。
 * 变量：`isOpen` 控制弹窗开关；`preferences` 保存当前偏好；`dict` 提供多语言文案；`isMounted` 防止卸载后继续写状态。
 * Integration: Render this component once in the root layout so every page shares a single cookie-consent reconciliation flow.
 * 接入方式：在根布局中只渲染一次本组件，让所有页面共用同一条 Cookie 同意对账链路。
 * Error Handling: Falls back to the default closed-world state when reconciliation throws, and only reopens the modal when no synchronized preference can be trusted.
 * 错误处理：当对账流程抛错时会回退到默认保守状态，且只有在无法信任任何同步偏好时才重新打开弹窗。
 * Keywords: consent modal, cookie sync, privacy, legal, account, 同意弹窗, Cookie 同步, 隐私, 法律文档, 账号
 */
export const CookieConsentModal = () => {
  const dict = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>(DEFAULT_COOKIE_PREFERENCES);

  useEffect(() => {
    let isMounted = true;

    const loadCookieConsentState = async () => {
      try {
        const result = await reconcileCookiePreferences();
        if (!isMounted) {
          return;
        }

        setPreferences(result.preferences ?? DEFAULT_COOKIE_PREFERENCES);
        setIsOpen(result.shouldOpenModal);
      } catch (error) {
        console.error('Failed to check cookie consent:', error);
        if (!isMounted) {
          return;
        }

        setPreferences(DEFAULT_COOKIE_PREFERENCES);
        setIsOpen(true);
      }
    };

    loadCookieConsentState();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async (prefs: CookiePreferences) => {
    setPreferences(prefs);
    setIsOpen(false);
    await saveCookiePreferences(prefs);
  };

  const handleAcceptAll = () => {
    const all: CookiePreferences = { essential: true, analytics: true, marketing: true };
    setPreferences(all);
    void handleSave(all);
  };

  const handleSavePreferences = () => {
    void handleSave(preferences);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card text-card-foreground border border-border shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          <h2 className="text-2xl font-bold mb-4">{dict.consent?.title || 'Terms of Service & Privacy Policy'}</h2>
          <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
            {dict.consent?.description || "We use cookies and similar technologies to enhance your experience, analyze our traffic, and personalize content. By clicking 'Accept All', you agree to the storing of cookies on your device. You can manage your preferences below. These preferences will sync with your account."}
          </p>

          <div className="space-y-4 mt-6">
            <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/30">
              <div>
                <h3 className="font-semibold">{dict.consent?.essential || 'Essential Cookies'}</h3>
                <p className="text-xs text-muted-foreground">{dict.consent?.essentialDesc || 'Required for the website to function properly.'}</p>
              </div>
              <input type="checkbox" checked disabled className="w-5 h-5 accent-primary cursor-not-allowed opacity-50" />
            </div>

            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <h3 className="font-semibold">{dict.consent?.analytics || 'Analytics Cookies'}</h3>
                <p className="text-xs text-muted-foreground">{dict.consent?.analyticsDesc || 'Help us understand how visitors interact with the website.'}</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.analytics}
                onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <h3 className="font-semibold">{dict.consent?.marketing || 'Marketing Cookies'}</h3>
                <p className="text-xs text-muted-foreground">{dict.consent?.marketingDesc || 'Used to deliver relevant advertisements.'}</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.marketing}
                onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
            </div>
          </div>

          <div className="mt-6 text-xs text-muted-foreground">
            {dict.consent?.readMore || 'Read more about our'} <Link href="/terms" className="underline text-primary">{dict.consent?.terms || 'Terms'}</Link> {dict.consent?.and || 'and'} <Link href="/privacy" className="underline text-primary">{dict.consent?.privacy || 'Privacy Policy'}</Link>.
          </div>
        </div>

        <div className="border-t border-border p-4 bg-muted/20 flex justify-end gap-3 flex-wrap">
          <Button variant="outline" onClick={handleSavePreferences}>
            {dict.consent?.savePreferences || 'Save Preferences'}
          </Button>
          <Button onClick={handleAcceptAll}>
            {dict.consent?.acceptAll || 'Accept All'}
          </Button>
        </div>
      </div>
    </div>
  );
};

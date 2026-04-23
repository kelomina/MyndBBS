'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from './TranslationProvider';
import { Button } from './ui/Button';

type CookiePreferences = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
};

const COOKIE_CONSENT_STORAGE_KEY = 'myndbbs_cookie_consent';

/**
 * Callers: [CookieConsentModal, readStoredCookiePreferences]
 * Callees: []
 * Description: Normalizes arbitrary preference payloads into the strict cookie-preference shape used by the UI and backend sync.
 * 描述：把任意偏好对象归一化成 UI 和后端同步都使用的严格 cookie 偏好结构。
 * Variables: `rawValue` 表示原始输入；`source` 表示对象化后的来源数据。
 * 变量：`rawValue` 是原始输入；`source` 是对象化后的来源数据。
 * Integration: Use this helper before writing cookie preferences into React state, localStorage, or API payloads.
 * 接入方式：在把 cookie 偏好写入 React state、localStorage 或 API 请求体之前调用本函数。
 * Error Handling: Non-object inputs degrade to the default cookie settings instead of throwing.
 * 错误处理：非对象输入会自动退化为默认 cookie 设置，不会抛异常。
 * Keywords: cookie preferences, normalize, state, storage, sync, Cookie 偏好, 归一化, 状态, 存储, 同步
 */
function normalizeCookiePreferences(rawValue: unknown): CookiePreferences {
  const source =
    rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)
      ? (rawValue as Record<string, unknown>)
      : {};

  return {
    essential: true,
    analytics: Boolean(source.analytics),
    marketing: Boolean(source.marketing),
  };
}

/**
 * Callers: [CookieConsentModal]
 * Callees: [normalizeCookiePreferences]
 * Description: Reads the locally stored cookie preferences from browser storage and converts them into the UI shape.
 * 描述：从浏览器本地存储中读取 cookie 偏好，并转换成界面使用的结构。
 * Variables: `storedValue` 表示 localStorage 原始字符串。
 * 变量：`storedValue` 表示 localStorage 中的原始字符串。
 * Integration: Call this helper during client-side consent reconciliation before deciding whether to open the modal.
 * 接入方式：在客户端进行同意状态对账时调用，再决定是否打开弹窗。
 * Error Handling: Invalid JSON is removed from localStorage and treated as missing consent.
 * 错误处理：无效 JSON 会从 localStorage 中删除，并按“未记录同意”处理。
 * Keywords: local storage, cookie consent, parse, browser, fallback, 本地存储, Cookie 同意, 解析, 浏览器, 回退
 */
function readStoredCookiePreferences(): CookiePreferences | null {
  const storedValue = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  if (!storedValue) {
    return null;
  }

  try {
    return normalizeCookiePreferences(JSON.parse(storedValue));
  } catch {
    localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
    return null;
  }
}

/**
 * Callers: [CookieConsentModal, reconcileCookieConsentState]
 * Callees: []
 * Description: Writes normalized cookie preferences into browser storage so the current device can reuse them.
 * 描述：把归一化后的 cookie 偏好写入浏览器本地存储，供当前设备复用。
 * Variables: `preferences` 表示需要持久化的 cookie 偏好。
 * 变量：`preferences` 表示需要持久化的 cookie 偏好。
 * Integration: Use this helper whenever consent is accepted locally or synchronized down from the account profile.
 * 接入方式：在本地保存同意结果或从账号资料下行同步偏好时调用本函数。
 * Error Handling: Relies on browser storage availability inside this client component and does not swallow storage exceptions.
 * 错误处理：依赖客户端组件内可用的浏览器存储能力，不额外吞掉存储异常。
 * Keywords: write storage, cookie consent, device sync, local cache, browser, 写入存储, Cookie 同意, 设备同步, 本地缓存, 浏览器
 */
function writeStoredCookiePreferences(preferences: CookiePreferences): void {
  localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(preferences));
}

/**
 * Callers: [CookieConsentModal, reconcileCookieConsentState]
 * Callees: [fetch]
 * Description: Persists cookie preferences to the signed-in account when the backend session is available.
 * 描述：在后端会话可用时，把 cookie 偏好持久化到已登录账号。
 * Variables: `preferences` 表示要同步到账号的偏好；`response` 表示接口响应结果。
 * 变量：`preferences` 表示要同步到账号的偏好；`response` 表示接口响应。
 * Integration: Call this helper after local consent is recorded or when local consent must backfill an empty server-side profile.
 * 接入方式：在本地记录同意结果后，或用本地偏好回填空的服务端资料时调用。
 * Error Handling: Returns `false` on network failures or non-2xx responses so callers can safely fall back to local-only state.
 * 错误处理：网络失败或非 2xx 响应时返回 `false`，调用方可以安全回退到仅本地状态。
 * Keywords: account sync, cookie API, fetch, persistence, profile, 账号同步, Cookie 接口, 请求, 持久化, 资料
 */
async function persistCookiePreferences(preferences: CookiePreferences): Promise<boolean> {
  try {
    const response = await fetch('/api/v1/user/cookie-preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'include',
      body: JSON.stringify({ preferences }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Callers: [RootLayout]
 * Callees: [useTranslation, normalizeCookiePreferences, readStoredCookiePreferences, writeStoredCookiePreferences, persistCookiePreferences]
 * Description: Reconciles cookie consent between device storage and the signed-in account, then renders the consent modal when needed.
 * 描述：在设备本地存储与登录账号之间对账 cookie 同意状态，并在缺失同意时渲染授权弹窗。
 * Variables: `isOpen` 控制弹窗开关；`preferences` 保存当前偏好；`dict` 提供多语言文案。
 * 变量：`isOpen` 控制弹窗是否显示；`preferences` 保存当前偏好；`dict` 提供国际化文案。
 * Integration: Render this component once in the root layout so every page shares one consent reconciliation flow.
 * 接入方式：在根布局中渲染一次本组件，让所有页面共用同一个同意状态对账流程。
 * Error Handling: Falls back to local consent storage when profile fetch or account sync fails, and only opens the modal when no valid consent exists.
 * 错误处理：当资料查询或账号同步失败时回退到本地同意状态；只有在本地和服务端都没有有效同意时才打开弹窗。
 * Keywords: consent modal, cookie sync, privacy, legal, account, 同意弹窗, Cookie 同步, 隐私, 法律文档, 账号
 */
export const CookieConsentModal = () => {
  const dict = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    let isMounted = true;

    const reconcileCookieConsentState = async () => {
      const localPreferences = readStoredCookiePreferences();
      if (localPreferences && isMounted) {
        setPreferences(localPreferences);
      }

      try {
        const res = await fetch('/api/v1/user/profile', { credentials: 'include' });
        if (!isMounted) {
          return;
        }

        if (res.ok) {
          const data = await res.json();
          if (!isMounted) {
            return;
          }

          const remotePreferences = data.user?.cookiePreferences
            ? normalizeCookiePreferences(data.user.cookiePreferences)
            : null;

          if (remotePreferences) {
            writeStoredCookiePreferences(remotePreferences);
            setPreferences(remotePreferences);
            setIsOpen(false);
            return;
          }

          if (localPreferences) {
            await persistCookiePreferences(localPreferences);
            if (isMounted) {
              setIsOpen(false);
            }
            return;
          }

          setIsOpen(true);
          return;
        }

        if (!localPreferences) {
          setIsOpen(true);
        }
      } catch (error) {
        console.error('Failed to check cookie consent:', error);
        if (!localPreferences && isMounted) {
          setIsOpen(true);
        }
      }
    };

    reconcileCookieConsentState();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async (prefs: CookiePreferences) => {
    setIsOpen(false);
    writeStoredCookiePreferences(prefs);
    await persistCookiePreferences(prefs);
  };

  const handleAcceptAll = () => {
    const all = { essential: true, analytics: true, marketing: true };
    setPreferences(all);
    handleSave(all);
  };

  const handleSavePreferences = () => {
    handleSave(preferences);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card text-card-foreground border border-border shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          <h2 className="text-2xl font-bold mb-4">{dict.consent?.title || "Terms of Service & Privacy Policy"}</h2>
          <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
            {dict.consent?.description || "We use cookies and similar technologies to enhance your experience, analyze our traffic, and personalize content. By clicking 'Accept All', you agree to the storing of cookies on your device. You can manage your preferences below. These preferences will sync with your account."}
          </p>

          <div className="space-y-4 mt-6">
            <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/30">
              <div>
                <h3 className="font-semibold">{dict.consent?.essential || "Essential Cookies"}</h3>
                <p className="text-xs text-muted-foreground">{dict.consent?.essentialDesc || "Required for the website to function properly."}</p>
              </div>
              <input type="checkbox" checked disabled className="w-5 h-5 accent-primary cursor-not-allowed opacity-50" />
            </div>

            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <h3 className="font-semibold">{dict.consent?.analytics || "Analytics Cookies"}</h3>
                <p className="text-xs text-muted-foreground">{dict.consent?.analyticsDesc || "Help us understand how visitors interact with the website."}</p>
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
                <h3 className="font-semibold">{dict.consent?.marketing || "Marketing Cookies"}</h3>
                <p className="text-xs text-muted-foreground">{dict.consent?.marketingDesc || "Used to deliver relevant advertisements."}</p>
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
            {dict.consent?.readMore || "Read more about our"} <Link href="/terms" className="underline text-primary">{dict.consent?.terms || "Terms"}</Link> {dict.consent?.and || "and"} <Link href="/privacy" className="underline text-primary">{dict.consent?.privacy || "Privacy Policy"}</Link>.
          </div>
        </div>

        <div className="border-t border-border p-4 bg-muted/20 flex justify-end gap-3 flex-wrap">
          <Button variant="outline" onClick={handleSavePreferences}>
            {dict.consent?.savePreferences || "Save Preferences"}
          </Button>
          <Button onClick={handleAcceptAll}>
            {dict.consent?.acceptAll || "Accept All"}
          </Button>
        </div>
      </div>
    </div>
  );
};

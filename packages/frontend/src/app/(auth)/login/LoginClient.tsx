'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Fingerprint, Loader2 } from 'lucide-react';
import { usePasskey } from '../../../lib/hooks/usePasskey';
import { TwoFactorLogin } from '../../../components/TwoFactorLogin';
import type { Dictionary } from '../../../types';
import { fetchWithAuth } from '../../../lib/api/fetcher';

export function LoginClient({ dict }: { dict: Dictionary }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const searchParams = useSearchParams();
  const oidcError = searchParams.get('oidc') === 'failed' ? dict.auth.ssoLoginFailed : null;
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorMethods, setTwoFactorMethods] = useState<string[]>([]);
  const { executePasskeyFlow, passkeyLoading, passkeyError } = usePasskey();
  const [passkeySupported, setPasskeySupported] = useState<boolean | null>(null);
  const [uiMode, setUiMode] = useState<'passkey' | 'password'>('password');
  const [ssoChecking, setSsoChecking] = useState(false);

  useEffect(() => {
    const checkPasskeySupport = async () => {
      const supported = typeof window !== 'undefined' && 'PublicKeyCredential' in window;
      if (supported && window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
        const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setPasskeySupported(available);
        setUiMode(available ? 'passkey' : 'password');
      } else {
        setPasskeySupported(supported);
        setUiMode(supported ? 'passkey' : 'password');
      }
    };
    checkPasskeySupport();
  }, []);

  /**
   * 处理 KoloStudio SSO 登录按钮点击。
   * 先用隐藏 iframe 尝试静默登录（prompt=none），
   * 如果用户已在 SSO 登录，直接拿到 code 完成认证；
   * 如果未登录，跳转到交互式登录页。
   */
  const handleKoloSsoLogin = () => {
    setSsoChecking(true);

    // 创建隐藏的 iframe 加载静默检查页面
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = '/api/v1/auth/oidc/silent-check';
    document.body.appendChild(iframe);

    // 监听 postMessage 结果
    const messageHandler = (event: MessageEvent) => {
      // 只接受来自我们 iframe 的消息
      if (event.source !== iframe.contentWindow) return;

      const data = event.data;
      if (data?.type === 'oidc:silent:success' && data.code) {
        // 静默登录成功，拿到 code，直接走 callback
        window.removeEventListener('message', messageHandler);
        document.body.removeChild(iframe);
        // 跳转到 callback 接口，用 code 换 token
        window.location.href = '/api/v1/auth/oidc/callback?code=' + encodeURIComponent(data.code);
      } else if (data?.type === 'oidc:silent:error') {
        // 静默登录失败（未登录或超时），跳转到交互式登录
        window.removeEventListener('message', messageHandler);
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
        setSsoChecking(false);
        window.location.href = '/api/v1/auth/oidc/start';
      }
    };

    window.addEventListener('message', messageHandler);

    // 超时保护：6秒后如果还没收到消息，直接跳转交互式登录
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
      setSsoChecking(false);
      window.location.href = '/api/v1/auth/oidc/start';
    }, 6500);
  };

      const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetchWithAuth('/api/v1/auth/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        if (data.requires2FA) {
          setRequires2FA(true);
          setTwoFactorMethods(data.methods || []);
        } else {
          window.location.href = '/';
        }
      } else {
        setError(dict.apiErrors?.[data.error as keyof typeof dict.apiErrors] || data.error || dict.auth.loginFailed);
      }
    } catch {
      setError(dict.auth.networkError);
    } finally {
      setLoading(false);
    }
  };

    const handlePasskeyLogin = async () => {
    executePasskeyFlow(
      'login',
      '/api/v1/auth/passkey/generate-authentication-options',
      '/api/v1/auth/passkey/verify-authentication',
      dict,
      () => { window.location.href = '/'; }
    );
  };

  if (requires2FA) {
    return <TwoFactorLogin methods={twoFactorMethods} />;
  }

  return (
    <div className="rounded-2xl bg-card px-8 py-10 shadow-sm border border-border/50">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{dict.auth.welcomeBack}</h2>
        <p className="mt-2 text-sm text-muted">{dict.auth.signInToAccount}</p>
      </div>

      {(error || passkeyError || oidcError) && (
        <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {error || passkeyError || oidcError}
        </div>
      )}

      {/* KoloStudio SSO 登录按钮 */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={handleKoloSsoLogin}
          disabled={loading || ssoChecking}
          className="flex w-full items-center justify-center gap-3 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-sm hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {ssoChecking ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>正在检查登录状态...</span>
            </>
          ) : (
            <>
              <svg className="h-5 w-5" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <rect width="28" height="28" rx="8" fill="#0EA5E9" />
                <text
                  x="14"
                  y="19.8"
                  textAnchor="middle"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontSize="16"
                  fontWeight="800"
                  fill="white"
                >
                  K
                </text>
              </svg>
              <span>{dict.auth.signInWithKoloSso}</span>
            </>
          )}
        </button>

        {uiMode === 'passkey' && passkeySupported !== false && (
          <button
            type="button"
            onClick={handlePasskeyLogin}
            disabled={loading || passkeyLoading}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:bg-background transition-colors disabled:opacity-50"
          >
            <Fingerprint className="h-5 w-5 text-primary" />
            {passkeyLoading ? dict.auth.signingIn : dict.auth.signInWithPasskey}
          </button>
        )}
      </div>

      {uiMode === 'password' && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {dict.auth.passwordLoginNotRecommended && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300">
              {dict.auth.passwordLoginNotRecommended}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground">{dict.auth.emailAddress}</label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-border px-3 py-2 bg-background focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground">{dict.auth.password}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-border px-3 py-2 bg-background focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input type="checkbox" className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
              <label className="ml-2 block text-sm text-muted">{dict.auth.rememberMe}</label>
            </div>
            <div className="text-sm">
              <Link href="/forgot-password" className="font-medium text-primary hover:text-primary/80">
                {dict.auth.forgotPassword}
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || passkeyLoading}
            className="flex w-full justify-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-sm hover:bg-foreground/90 transition-colors disabled:opacity-50"
          >
            {loading ? dict.auth.signingIn : dict.auth.signIn}
          </button>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-muted">
        {dict.auth.dontHaveAccount}{' '}
        <Link href="/register" className="font-medium text-primary hover:text-primary/80">
          {dict.auth.signUpNow}
        </Link>
      </p>
      {uiMode === 'passkey' && passkeySupported !== false && (
        <button
          type="button"
          onClick={() => setUiMode('password')}
          className="mt-1 block w-full text-center text-[11px] font-medium leading-4 text-muted/70 hover:text-foreground hover:underline hover:underline-offset-2"
        >
          {dict.auth.cannotUsePasskey}
        </button>
      )}
    </div>
  );
}

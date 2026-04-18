'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Fingerprint } from 'lucide-react';
import { usePasskey } from '../../../lib/hooks/usePasskey';
import { TwoFactorLogin } from '../../../components/TwoFactorLogin';
import type { Dictionary } from '../../../types';

export function LoginClient({ dict }: { dict: Dictionary }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorMethods, setTwoFactorMethods] = useState<string[]>([]);
  const { executePasskeyFlow, passkeyLoading, passkeyError } = usePasskey();
  const [passkeySupported, setPasskeySupported] = useState<boolean | null>(null);
  const [uiMode, setUiMode] = useState<'passkey' | 'password'>('password');

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

      const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include',
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
        setError(dict.apiErrors?.[data.error] || data.error || dict.auth.loginFailed);
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

      {(error || passkeyError) && (
        <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {error || passkeyError}
        </div>
      )}
      {false && (
        <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {uiMode === 'password' && (
        <form onSubmit={handleSubmit} className="space-y-6">
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
              <a href="#" className="font-medium text-primary hover:text-primary/80">{dict.auth.forgotPassword}</a>
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

      {uiMode === 'passkey' && passkeySupported !== false && (
        <div className="mt-6 space-y-4">
          <button 
            type="button"
            onClick={handlePasskeyLogin}
            disabled={loading || passkeyLoading}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-sm hover:bg-foreground/90 transition-colors disabled:opacity-50"
          >
            <Fingerprint className="h-5 w-5 text-primary" />
            {passkeyLoading ? dict.auth.signingIn : dict.auth.signInWithPasskey}
          </button>
          
          <button 
            type="button"
            onClick={() => setUiMode('password')}
            className="flex w-full items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-background transition-colors"
          >
            {dict.auth.cannotUsePasskey}
          </button>
        </div>
      )}

      <p className="mt-8 text-center text-sm text-muted">
        {dict.auth.dontHaveAccount}{' '}
        <Link href="/register" className="font-medium text-primary hover:text-primary/80">
          {dict.auth.signUpNow}
        </Link>
      </p>
    </div>
  );
}

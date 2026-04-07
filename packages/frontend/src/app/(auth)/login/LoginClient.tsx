'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Fingerprint } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import { TwoFactorLogin } from '../../../components/TwoFactorLogin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function LoginClient({ dict }: { dict: any }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorMethods, setTwoFactorMethods] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setError('');
    setLoading(true);

    try {
      // 1. Get options from server
      const optionsRes = await fetch('/api/v1/auth/passkey/generate-authentication-options');
      const optionsData = await optionsRes.json();

      if (!optionsRes.ok) {
        throw new Error(optionsData.error || 'Failed to generate passkey options');
      }

      const { challengeId, ...options } = optionsData;

      // 2. Invoke WebAuthn
      let authResponse;
      try {
        authResponse = await startAuthentication(options);
      } catch (err) {
        const errorObj = err as Error;
        const errorMessage = errorObj?.message || '';
        if (errorObj?.name === 'NotAllowedError' || errorMessage.includes('timed out or was not allowed')) {
          setError(dict.auth.passkeyCancelled);
        } else {
          setError(errorMessage || dict.auth.passkeyFailed);
        }
        setLoading(false);
        return;
      }

      // 3. Verify response
      const verifyRes = await fetch('/api/v1/auth/passkey/verify-authentication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: authResponse, challengeId })
      });

      const verifyData = await verifyRes.json();

      if (verifyRes.ok) {
        window.location.href = '/';
      } else {
        setError(verifyData.error || dict.auth.passkeyVerificationFailed);
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || dict.auth.passkeyError);
      } else {
        setError(dict.auth.passkeyError);
      }
    } finally {
      setLoading(false);
    }
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

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
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
          disabled={loading}
          className="flex w-full justify-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-sm hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {loading ? 'Signing in...' : dict.auth.signIn}
        </button>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-sm"><span className="bg-card px-2 text-muted">{dict.auth.orContinueWith}</span></div>
        </div>
        <div className="mt-6">
          <button 
            type="button"
            onClick={handlePasskeyLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-background transition-colors disabled:opacity-50"
          >
            <Fingerprint className="h-5 w-5 text-primary" />
            {dict.auth.signInWithPasskey}
          </button>
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        {dict.auth.dontHaveAccount}{' '}
        <Link href="/register" className="font-medium text-primary hover:text-primary/80">
          {dict.auth.signUpNow}
        </Link>
      </p>
    </div>
  );
}

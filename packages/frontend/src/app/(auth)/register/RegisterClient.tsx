'use client';

import React, { useState } from 'react';
import Link from 'next/link';

import { SliderCaptcha } from '../../../components/SliderCaptcha';
import { TwoFactorSetup } from '../../../components/TwoFactorSetup';
import { isValidPassword } from '@myndbbs/shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
/**
 * Callers: []
 * Callees: [useState, preventDefault, setError, isValidPassword, setLoading, fetch, stringify, json, setRequires2FA, setCaptchaId, setEmail, setUsername, setPassword]
 * Description: Handles the register client logic for the application.
 * Keywords: registerclient, register, client, auto-annotated
 */
export function RegisterClient({ dict }: { dict: any }) {
  
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaId, setCaptchaId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);

  /**
     * Callers: []
     * Callees: [preventDefault, setError, isValidPassword, setLoading, fetch, stringify, json, setRequires2FA, setCaptchaId]
     * Description: Handles the handle submit logic for the application.
     * Keywords: handlesubmit, handle, submit, auto-annotated
     */
    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!captchaId) {
      setError(dict.auth.completeSecurityVerificationFirst);
      return;
    }

    if (password.length < 8 || password.length > 128) {
      setError(dict.auth.passwordLengthError);
      return;
    }
    
    if (!isValidPassword(password)) {
      setError(dict.auth.passwordComplexityError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include',
        body: JSON.stringify({ email, username, password, captchaId })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setRequires2FA(true);
      } else {
        setError(dict.apiErrors?.[data.error] || data.error || dict.auth.registrationFailed);
        setCaptchaId(null); // Force re-verification on fail
      }
    } catch (err) {
      setError(dict.auth.networkError);
    } finally {
      setLoading(false);
    }
  };

  if (requires2FA) {
    return <TwoFactorSetup />;
  }

  return (
    <div className="rounded-2xl bg-card px-8 py-10 shadow-sm border border-border/50">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{dict.auth.joinMyndbbs}</h2>
        <p className="mt-2 text-sm text-muted">{dict.auth.createAccountToJoin}</p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-foreground">{dict.auth.emailAddress}</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-border px-3 py-2 bg-background focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">{dict.auth.username}</label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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
          <p className="mt-1 text-xs text-muted">{dict.auth.passwordHint}</p>
        </div>

        {/* Slider Captcha Integration */}
        {!captchaId ? (
          <SliderCaptcha onSuccess={(id) => setCaptchaId(id)} />
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 py-3.5 px-4 text-sm font-medium text-emerald-700 dark:text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.1)]">
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white shadow-[0_0_10px_rgba(52,211,153,0.5)]">✓</div>
            <span>{dict.auth.securityVerificationPassed}</span>
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={loading || !captchaId}
            className="flex w-full justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors disabled:opacity-50"
          >
            {loading ? dict.auth.creating : dict.auth.createAccount}
          </button>
        </div>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        {dict.auth.alreadyHaveAccount}{' '}
        <Link href="/login" className="font-medium text-primary hover:text-primary/80">
          {dict.auth.signIn}
        </Link>
      </p>
    </div>
  );
}

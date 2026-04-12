'use client';

import React, { useEffect, useState } from 'react';
import { usePasskey } from '../lib/hooks/usePasskey';
import { useTranslation } from './TranslationProvider';

interface TwoFactorLoginProps {
  methods: string[];
}

/**
 * Callers: []
 * Callees: [useTranslation, useState, usePasskey, includes, useEffect, tryPasskeyLogin, setPasskeyError, executePasskeyFlow, setError, setCurrentMethod, preventDefault, setLoading, fetch, stringify, json, setTotpCode]
 * Description: Handles the two factor login logic for the application.
 * Keywords: twofactorlogin, two, factor, login, auto-annotated
 */
export function TwoFactorLogin({ methods }: TwoFactorLoginProps) {
  const dict = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const { executePasskeyFlow, passkeyLoading, passkeyError, setPasskeyError } = usePasskey();
  const [currentMethod, setCurrentMethod] = useState<'passkey' | 'totp' | null>(
    methods.includes('passkey') ? 'passkey' : 'totp'
  );

  useEffect(() => {
    if (currentMethod === 'passkey') {
      tryPasskeyLogin();
    }
  }, [currentMethod]);

  /**
     * Callers: []
     * Callees: [setPasskeyError, executePasskeyFlow, includes, setError, setCurrentMethod]
     * Description: Handles the try passkey login logic for the application.
     * Keywords: trypasskeylogin, try, passkey, login, auto-annotated
     */
    const tryPasskeyLogin = async () => {
    setPasskeyError('');
    executePasskeyFlow(
      'login',
      '/api/v1/auth/passkey/generate-authentication-options',
      '/api/v1/auth/passkey/verify-authentication',
      dict,
      () => {
        window.location.href = '/';
      },
      (err) => {
        const isCancel = err?.name === 'NotAllowedError' || err?.message?.includes('timed out or was not allowed');
        if (!isCancel) {
          setError(err.message || dict.auth.passkeyFailed);
        }
        if (methods.includes('totp')) {
          setCurrentMethod('totp');
        }
      }
    );
  };

  /**
     * Callers: []
     * Callees: [preventDefault, setLoading, setError, fetch, stringify, json]
     * Description: Handles the verify totp logic for the application.
     * Keywords: verifytotp, verify, totp, auto-annotated
     */
    const verifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/totp/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpCode }),
      });
      
      if (res.ok) {
        window.location.href = '/';
      } else {
        const data = await res.json();
        setError(dict.apiErrors?.[data.error] || data.error || dict.twoFactor.invalidTotpCode);
      }
    } catch (err) {
      setError(dict.auth.networkError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-card px-8 py-10 shadow-sm border border-border/50 text-center">
      <h2 className="text-2xl font-bold tracking-tight text-foreground mb-4">{dict.twoFactor.title}</h2>
      
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {currentMethod === 'passkey' && (
        <div className="space-y-4">
          <p className="text-muted text-sm">{dict.twoFactor.waitingPasskeyLogin}</p>
          <div className="animate-pulse bg-primary/20 h-2 w-full rounded"></div>
          {methods.includes('totp') && (
            <button 
              onClick={() => setCurrentMethod('totp')}
              className="text-sm text-primary hover:underline mt-4 block mx-auto"
            >
              {dict.twoFactor.useAuthenticatorApp}
            </button>
          )}
        </div>
      )}

      {currentMethod === 'totp' && (
        <form onSubmit={verifyTotp} className="space-y-6">
          <p className="text-sm text-muted">{dict.twoFactor.enterTotpHint}</p>
          <div>
            <input
              type="text"
              required
              placeholder={dict.twoFactor.enter6DigitCode}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="block w-full text-center tracking-widest text-lg rounded-lg border border-border px-3 py-2 bg-background focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
              maxLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={loading || totpCode.length < 6}
            className="flex w-full justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors disabled:opacity-50"
          >
            {loading ? dict.twoFactor.verifying : dict.twoFactor.verify}
          </button>
          {methods.includes('passkey') && (
            <button 
              onClick={() => setCurrentMethod('passkey')}
              type="button"
              className="text-sm text-primary hover:underline mt-4 block mx-auto bg-transparent border-none"
            >
              {dict.twoFactor.tryPasskeyAgain}
            </button>
          )}
        </form>
      )}
    </div>
  );
}

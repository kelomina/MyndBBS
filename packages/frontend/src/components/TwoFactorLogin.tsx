'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startAuthentication } from '@simplewebauthn/browser';

interface TwoFactorLoginProps {
  methods: string[];
}

export function TwoFactorLogin({ methods }: TwoFactorLoginProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [currentMethod, setCurrentMethod] = useState<'passkey' | 'totp' | null>(
    methods.includes('passkey') ? 'passkey' : 'totp'
  );

  useEffect(() => {
    if (currentMethod === 'passkey') {
      tryPasskeyLogin();
    }
  }, [currentMethod]);

  const tryPasskeyLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const optionsRes = await fetch('/api/v1/auth/passkey/generate-authentication-options', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!optionsRes.ok) {
        throw new Error('Failed to generate passkey options');
      }
      const options = await optionsRes.json();

      const attResp = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch('/api/v1/auth/passkey/verify-authentication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: attResp }),
      });

      if (verifyRes.ok) {
        router.push('/');
        router.refresh();
      } else {
        const data = await verifyRes.json();
        throw new Error(data.error || 'Passkey verification failed');
      }
    } catch (err) {
      const errorObj = err as Error;
      console.error('Passkey login failed:', err);
      const isCancel = errorObj?.name === 'NotAllowedError' || errorObj?.message?.includes('timed out or was not allowed');
      if (!isCancel) {
        setError(errorObj.message || 'Passkey login failed');
      }
      if (methods.includes('totp')) {
        setCurrentMethod('totp');
      }
    } finally {
      setLoading(false);
    }
  };

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
        router.push('/');
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || 'Invalid TOTP code');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-card px-8 py-10 shadow-sm border border-border/50 text-center">
      <h2 className="text-2xl font-bold tracking-tight text-foreground mb-4">Two-Factor Authentication</h2>
      
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {currentMethod === 'passkey' && (
        <div className="space-y-4">
          <p className="text-muted text-sm">Waiting for passkey login...</p>
          <div className="animate-pulse bg-primary/20 h-2 w-full rounded"></div>
          {methods.includes('totp') && (
            <button 
              onClick={() => setCurrentMethod('totp')}
              className="text-sm text-primary hover:underline mt-4 block mx-auto"
            >
              Use Authenticator App instead
            </button>
          )}
        </div>
      )}

      {currentMethod === 'totp' && (
        <form onSubmit={verifyTotp} className="space-y-6">
          <p className="text-sm text-muted">Enter the 6-digit code from your Authenticator App.</p>
          <div>
            <input
              type="text"
              required
              placeholder="Enter 6-digit code"
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
            {loading ? 'Verifying...' : 'Verify'}
          </button>
          {methods.includes('passkey') && (
            <button 
              onClick={() => setCurrentMethod('passkey')}
              type="button"
              className="text-sm text-primary hover:underline mt-4 block mx-auto bg-transparent border-none"
            >
              Try Passkey again
            </button>
          )}
        </form>
      )}
    </div>
  );
}

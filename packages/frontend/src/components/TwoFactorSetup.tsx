'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import Image from 'next/image';
import { useTranslation } from './TranslationProvider';

export function TwoFactorSetup({ onComplete, context = 'auth', forceTotp = false }: { onComplete?: () => void, context?: 'auth' | 'user', forceTotp?: boolean }) {
  const dict = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totpSetup, setTotpSetup] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [setupMethod, setSetupMethod] = useState<'passkey' | 'totp' | null>(null);

      const getEndpoint = useCallback((path: string) => {
    return context === 'user' ? `/api/v1/user${path}` : `/api/v1/auth${path}`;
  }, [context]);

      const loadTotp = useCallback(async () => {
    setSetupMethod('totp');
    setLoading(true);
    setError('');
    try {
      const res = await fetch(getEndpoint('/totp/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        setTotpSetup(data);
      } else {
        setError(dict.apiErrors?.[data.error] || data.error || dict.twoFactor.failedGenerateTotp);
      }
    } catch {
      setError(dict.auth.networkError);
    } finally {
      setLoading(false);
    }
  }, [dict, getEndpoint]);

      const tryPasskeyRegistration = useCallback(async () => {
    try {
      // 1. Get options from server
      const optionsRes = await fetch(getEndpoint('/passkey/generate-registration-options'), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!optionsRes.ok) {
        throw new Error('Failed to generate passkey options');
      }
      const options = await optionsRes.json();

      // 2. Start registration in browser
      const authOptions = options;
      if (!authOptions.extensions) authOptions.extensions = {};
      authOptions.extensions.prf = {};
      const attResp = await startRegistration({ optionsJSON: authOptions });

      // 3. Verify on server
      const verifyRes = await fetch(getEndpoint('/passkey/verify-registration'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ response: attResp, challengeId: options.challengeId }),
      });

      if (verifyRes.ok) {
        if (context === 'auth' && !forceTotp) {
          // Passkey verified. They are now logged in. We MUST enforce TOTP now.
          await loadTotp();
        } else {
          if (onComplete) onComplete();
          else window.location.href = '/';
        }
      } else {
        const data = await verifyRes.json();
        throw new Error(dict.apiErrors?.[data.error] || data.error || dict.auth.passkeyVerificationFailed);
      }
    } catch (err) {
      const errorObj = err as Error;
      console.error('Passkey registration failed:', err);
      const isCancel = errorObj?.name === 'NotAllowedError' || errorObj?.message?.includes('timed out or was not allowed');
      if (!isCancel) {
        setError(errorObj.message || dict.twoFactor.passkeySetupFailed);
      }
      await loadTotp();
    }
  }, [context, dict, forceTotp, getEndpoint, loadTotp, onComplete]);

      const initiateSetup = useCallback(async () => {
    try {
      if (forceTotp) {
        await loadTotp();
      } else if (window.PublicKeyCredential) {
        setSetupMethod('passkey');
        await tryPasskeyRegistration();
      } else {
        await loadTotp();
      }
    } catch (err) {
      console.error(err);
      await loadTotp();
    }
  }, [forceTotp, loadTotp, tryPasskeyRegistration]);

  useEffect(() => {
    void initiateSetup();
  }, [initiateSetup]);

      const verifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const endpoint = getEndpoint('/totp/verify');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ code: totpCode }),
      });
      
      if (res.ok) {
        if (onComplete) onComplete();
        else {
          window.location.href = '/';
        }
      } else {
        const data = await res.json();
        setError(dict.apiErrors?.[data.error] || data.error || dict.twoFactor.invalidTotpCode);
      }
    } catch {
      setError(dict.auth.networkError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-card px-8 py-10 shadow-sm border border-border/50 text-center">
      <h2 className="text-2xl font-bold tracking-tight text-foreground mb-4">{dict.twoFactor.setupTitle}</h2>
      
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {setupMethod === 'passkey' && !totpSetup && (
        <div className="space-y-4">
          <p className="text-muted text-sm">{dict.twoFactor.waitingPasskeySetup}</p>
          <div className="animate-pulse bg-primary/20 h-2 w-full rounded"></div>
          <button 
            onClick={() => void loadTotp()}
            className="text-sm text-primary hover:underline mt-4 block mx-auto"
          >
            {dict.twoFactor.useAuthenticatorApp}
          </button>
        </div>
      )}

      {setupMethod === 'totp' && totpSetup && (
        <div className="space-y-6">
          <p className="text-sm text-muted">{dict.twoFactor.scanQrHint}</p>
          <div className="flex justify-center p-4 bg-white rounded-xl inline-block mx-auto border border-gray-200">
            <Image src={totpSetup.qrCodeUrl} alt="TOTP QR Code" width={192} height={192} unoptimized />
          </div>
          <div className="text-sm text-muted">
            <p>{dict.twoFactor.enterSecretManually}</p>
            <code className="bg-muted p-1 rounded font-mono mt-1 block">{totpSetup.secret}</code>
          </div>
          
          <form onSubmit={verifyTotp} className="space-y-4">
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
              {loading ? dict.twoFactor.verifying : dict.twoFactor.verifyAndComplete}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

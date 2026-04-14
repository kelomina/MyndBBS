'use client';

import React, { useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from './TranslationProvider';

/**
 * Callers: []
 * Callees: [useTranslation, useState, useEffect, initiateSetup, fallbackToTotp, setSetupMethod, tryPasskeyRegistration, error, fetch, getEndpoint, json, startRegistration, stringify, loadTotp, onComplete, includes, setError, setLoading, setTotpSetup, preventDefault, setTotpCode]
 * Description: Handles the two factor setup logic for the application.
 * Keywords: twofactorsetup, two, factor, setup, auto-annotated
 */
export function TwoFactorSetup({ onComplete, context = 'auth', forceTotp = false }: { onComplete?: () => void, context?: 'auth' | 'user', forceTotp?: boolean }) {
  const dict = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totpSetup, setTotpSetup] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [setupMethod, setSetupMethod] = useState<'passkey' | 'totp' | null>(null);

  useEffect(() => {
    initiateSetup();
  }, []);

  /**
     * Callers: []
     * Callees: []
     * Description: Handles the get endpoint logic for the application.
     * Keywords: getendpoint, get, endpoint, auto-annotated
     */
    const getEndpoint = (path: string) => {
    return context === 'user' ? `/api/v1/user${path}` : `/api/v1/auth${path}`;
  };

  /**
     * Callers: []
     * Callees: [fallbackToTotp, setSetupMethod, tryPasskeyRegistration, error]
     * Description: Handles the initiate setup logic for the application.
     * Keywords: initiatesetup, initiate, setup, auto-annotated
     */
    const initiateSetup = async () => {
    try {
      if (forceTotp) {
        await fallbackToTotp();
      } else if (window.PublicKeyCredential) {
        setSetupMethod('passkey');
        await tryPasskeyRegistration();
      } else {
        await fallbackToTotp();
      }
    } catch (err) {
      console.error(err);
      await fallbackToTotp();
    }
  };

  /**
     * Callers: []
     * Callees: [fetch, getEndpoint, json, startRegistration, stringify, loadTotp, onComplete, error, includes, setError, fallbackToTotp]
     * Description: Handles the try passkey registration logic for the application.
     * Keywords: trypasskeyregistration, try, passkey, registration, auto-annotated
     */
    const tryPasskeyRegistration = async () => {
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
      await fallbackToTotp();
    }
  };

  /**
     * Callers: []
     * Callees: [setSetupMethod, setLoading, setError, fetch, getEndpoint, json, setTotpSetup]
     * Description: Handles the load totp logic for the application.
     * Keywords: loadtotp, load, totp, auto-annotated
     */
    const loadTotp = async () => {
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
    } catch (err) {
      setError(dict.auth.networkError);
    } finally {
      setLoading(false);
    }
  };

  /**
     * Callers: []
     * Callees: [loadTotp]
     * Description: Handles the fallback to totp logic for the application.
     * Keywords: fallbacktototp, fallback, to, totp, auto-annotated
     */
    const fallbackToTotp = async () => {
    await loadTotp();
  };

  /**
     * Callers: []
     * Callees: [preventDefault, setLoading, setError, getEndpoint, fetch, stringify, onComplete, json]
     * Description: Handles the verify totp logic for the application.
     * Keywords: verifytotp, verify, totp, auto-annotated
     */
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
    } catch (err) {
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
            onClick={fallbackToTotp}
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
            {/* The qrCodeUrl from backend is a Data URL, we can use an img tag */}
            <img src={totpSetup.qrCodeUrl} alt="TOTP QR Code" className="w-48 h-48" />
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

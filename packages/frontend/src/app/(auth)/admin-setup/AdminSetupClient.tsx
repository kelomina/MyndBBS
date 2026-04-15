'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startRegistration } from '@simplewebauthn/browser';
import Image from 'next/image';

import { useTranslation } from '../../../components/TranslationProvider';
import { fetcher } from '../../../lib/api/fetcher';

/**
 * Callers: []
 * Callees: [useTranslation, useRouter, useState, setLoading, setError, fetcher, startRegistration, stringify, setStep, loadTotp, error, setTotpSetup, setTimeout, push, setTotpCode]
 * Description: Handles the admin setup client logic for the application.
 * Keywords: adminsetupclient, admin, setup, client, auto-annotated
 */
export function AdminSetupClient() {
  const dict = useTranslation();
  const router = useRouter();
  const [step, setStep] = useState<'passkey' | 'totp' | 'done'>('passkey');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totpSetup, setTotpSetup] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');

  // 1. Setup Passkey
  /**
     * Callers: []
     * Callees: [setLoading, setError, fetcher, startRegistration, stringify, setStep, loadTotp, error]
     * Description: Handles the handle setup passkey logic for the application.
     * Keywords: handlesetuppasskey, handle, setup, passkey, auto-annotated
     */
    const handleSetupPasskey = async () => {
    setLoading(true);
    setError('');
    try {
      const options = await fetcher('/api/v1/auth/passkey/generate-registration-options');
      const authOptions = options;
      if (!authOptions.extensions) authOptions.extensions = {};
      authOptions.extensions.prf = {};
      const attResp = await startRegistration({ optionsJSON: authOptions });
      await fetcher('/api/v1/auth/passkey/verify-registration', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ response: attResp, challengeId: options.challengeId })
      });
      // Passkey verified! Now we must complete TOTP to finish setup.
      setStep('totp');
      loadTotp(true);
    } catch (err: unknown) {
      console.error(err);
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError') {
        setError(dict.settings?.passkeyNotSupported || 'Passkey is not supported or canceled on this device.');
      } else {
        setError((err instanceof Error ? err.message : '') || dict.settings?.failedLoadProfile || 'Failed to setup Passkey');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
     * Callers: []
     * Callees: [setStep, loadTotp]
     * Description: Handles the skip passkey logic for the application.
     * Keywords: skippasskey, skip, passkey, auto-annotated
     */
    const skipPasskey = () => {
    // If they skip passkey, they must setup TOTP via auth endpoint, which logs them in.
    setStep('totp');
    loadTotp(true);
  };

  // 2. Load TOTP
  /**
     * Callers: []
     * Callees: [setLoading, setError, fetcher, setTotpSetup]
     * Description: Handles the load totp logic for the application.
     * Keywords: loadtotp, load, totp, auto-annotated
     */
    const loadTotp = async (isAuthContext = false) => {
    setLoading(true);
    setError('');
    try {
      const endpoint = isAuthContext ? '/api/v1/auth/totp/generate' : '/api/v1/user/totp/generate';
      const data = await fetcher(endpoint, { method: 'POST' });
      setTotpSetup(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create admin user');
    } finally {
      setLoading(false);
    }
  };

  // 3. Verify TOTP
  /**
     * Callers: []
     * Callees: [setError, setLoading, fetcher, stringify, setStep, setTimeout, push]
     * Description: Handles the handle verify totp logic for the application.
     * Keywords: handleverifytotp, handle, verify, totp, auto-annotated
     */
    const handleVerifyTotp = async () => {
    if (!totpCode || totpCode.length !== 6) {
      setError(dict.auth?.invalidTotp || 'Invalid 6-digit code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const endpoint = '/api/v1/auth/totp/verify';
      await fetcher(endpoint, {
        method: 'POST',
        body: JSON.stringify({ code: totpCode })
      });
      setStep('done');
      setTimeout(() => router.push('/admin'), 1500);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : '') || dict.auth?.invalidTotp || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-2xl shadow-sm border border-border">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">
            {dict.auth?.adminSetupTitle || 'Admin Security Setup'}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {dict.auth?.adminSetupDesc || 'Super Admins are required to bind both Passkey and Authenticator App.'}
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {step === 'passkey' && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-medium">{dict.auth?.step1Passkey || 'Step 1: Setup Passkey'}</h3>
              <p className="text-sm text-muted mt-1">{dict.auth?.step1Desc || 'Use your fingerprint, face, or screen lock to register a passkey.'}</p>
            </div>
            <button
              onClick={handleSetupPasskey}
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            >
              {loading ? dict.common?.loading || 'Loading...' : dict.auth?.registerPasskey || 'Register Passkey'}
            </button>
            <div className="text-center">
              <button onClick={skipPasskey} className="text-sm text-muted hover:text-foreground underline">
                {dict.auth?.skipPasskey || 'Skip for now (Device not supported)'}
              </button>
            </div>
          </div>
        )}

        {step === 'totp' && !totpSetup && !loading && (
          <div className="space-y-6 text-center">
            <p className="text-sm text-muted">{error || dict.auth?.failedLoadTotp || 'Failed to load Authenticator setup.'}</p>
            <button
              onClick={() => loadTotp(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        )}

        {step === 'totp' && totpSetup && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-medium">{dict.auth?.step2Totp || 'Step 2: Setup Authenticator App'}</h3>
              <p className="text-sm text-muted mt-1">{dict.auth?.step2Desc || 'Scan the QR code with Google Authenticator or Authy.'}</p>
            </div>
            <div className="flex justify-center bg-white p-4 rounded-lg">
              <Image src={totpSetup.qrCodeUrl} alt="TOTP QR Code" width={192} height={192} unoptimized />
            </div>
            <div className="text-center mt-2">
              <p className="text-xs text-muted font-mono">{totpSetup.secret}</p>
            </div>
            <div>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder={dict.auth?.enter6Digit || 'Enter 6-digit code'}
                className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                maxLength={6}
              />
            </div>
            <button
              onClick={handleVerifyTotp}
              disabled={loading || totpCode.length !== 6}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            >
              {loading ? dict.common?.loading || 'Verifying...' : dict.auth?.verifyTotp || 'Verify'}
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center space-y-4">
            <div className="text-green-500 text-5xl">✓</div>
            <h3 className="text-xl font-bold">{dict.auth?.setupComplete || 'Setup Complete!'}</h3>
            <p className="text-sm text-muted">{dict.auth?.redirectingAdmin || 'Redirecting to Admin Panel...'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

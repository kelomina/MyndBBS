import React, { useState, useEffect } from 'react';
import { useTranslation } from './TranslationProvider';
import { usePasskey } from '../lib/hooks/usePasskey';

interface ReauthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Callers: []
 * Callees: [useTranslation, useState, usePasskey, useEffect, setPassword, setTotpCode, setError, setPasskeyError, catch, then, fetch, json, setAvailableMethods, setMethod, preventDefault, setLoading, executePasskeyFlow, onSuccess, includes, stringify]
 * Description: Handles the reauth modal logic for the application.
 * Keywords: reauthmodal, reauth, modal, auto-annotated
 */
export function ReauthModal({ isOpen, onClose, onSuccess }: ReauthModalProps) {
  const dict = useTranslation();
  const [method, setMethod] = useState<'password' | 'totp' | 'passkey'>('password');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableMethods, setAvailableMethods] = useState<{ hasTotp: boolean, hasPasskey: boolean, hasPassword: boolean }>({ hasTotp: false, hasPasskey: false, hasPassword: true });
  const { executePasskeyFlow, passkeyError, setPasskeyError } = usePasskey();

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setTotpCode('');
      setError('');
      setPasskeyError('');
      // Fetch user profile to see what auth methods they have
      fetch('/api/v1/user/profile', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            setAvailableMethods({ hasTotp: data.user.isTotpEnabled, hasPasskey: data.user._count?.passkeys > 0, hasPassword: data.user.hasPassword !== false });
            if (data.user.hasPassword === false) {
              if (data.user._count?.passkeys > 0) setMethod('passkey');
              else if (data.user.isTotpEnabled) setMethod('totp');
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen, setPasskeyError]);

  if (!isOpen) return null;

  /**
     * Callers: []
     * Callees: [preventDefault, setLoading, setError, executePasskeyFlow, onSuccess, includes, fetch, stringify, json]
     * Description: Handles the handle submit logic for the application.
     * Keywords: handlesubmit, handle, submit, auto-annotated
     */
    const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (method === 'passkey') {
        executePasskeyFlow(
          'login',
          '/api/v1/user/sudo/passkey-options',
          '/api/v1/user/sudo/verify',
          dict,
          () => {
            onSuccess();
          },
          (err) => {
            const isCancel = err?.name === 'NotAllowedError' || err?.message?.includes('timed out or was not allowed');
            if (!isCancel) setError(err.message || dict.reauth?.verificationFailed || dict.reauth?.verificationFailed || 'Verification failed');
            setLoading(false);
          },
          { type: 'passkey' }
        );
        return; // executePasskeyFlow handles its own loading state
      }

      const res = await fetch('/api/v1/user/sudo/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include',
        body: JSON.stringify({ type: method, password: method === 'password' ? password : undefined, totpCode: method === 'totp' ? totpCode : undefined })
      });

      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        setError(dict.apiErrors?.[data.error] || data.error || dict.reauth?.verificationFailed || 'Verification failed');
      }
    } catch {
      setError(dict.reauth?.networkError || 'Network error');
    } finally {
      if (method !== 'passkey') {
        setLoading(false);
      }
    }
  };

  /**
     * Callers: []
     * Callees: [setMethod, setLoading, executePasskeyFlow, onSuccess, includes, setError]
     * Description: Handles the handle passkey click logic for the application.
     * Keywords: handlepasskeyclick, handle, passkey, click, auto-annotated
     */
    const handlePasskeyClick = () => {
    setMethod('passkey');
    // Need to wait for state update before submitting, so we just call submit directly with passkey logic inline
    // But since it's an async flow, we can just call it
    setLoading(true);
    executePasskeyFlow(
      'login',
      '/api/v1/user/sudo/passkey-options',
      '/api/v1/user/sudo/verify',
      dict,
      () => {
        onSuccess();
      },
      (err) => {
        const isCancel = err?.name === 'NotAllowedError' || err?.message?.includes('timed out or was not allowed');
        if (!isCancel) setError(err.message || dict.reauth?.verificationFailed || dict.reauth?.verificationFailed || 'Verification failed');
        setLoading(false);
      },
      { type: 'passkey' }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border border-border/50">
        <h3 className="text-xl font-bold text-foreground mb-2">{dict.reauth?.verifyIdentity || "Verify it's you"}</h3>
        <p className="text-sm text-muted mb-6">{dict.reauth?.confirmIdentity || 'Please confirm your identity to continue.'}</p>

        {(error || passkeyError) && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {error || passkeyError}
          </div>
        )}

        <div className="flex gap-2 mb-6">
          {availableMethods.hasPassword && (
            <button 
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${method === 'password' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              onClick={() => setMethod('password')}
            >{dict.reauth?.password || 'Password'}</button>
          )}
          {availableMethods.hasTotp && (
            <button 
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${method === 'totp' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              onClick={() => setMethod('totp')}
            >{dict.reauth?.authenticatorApp || 'Authenticator App'}</button>
          )}
          {availableMethods.hasPasskey && (
            <button 
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${method === 'passkey' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              onClick={handlePasskeyClick}
            >{dict.reauth?.passkey || 'Passkey'}</button>
          )}
        </div>

        {method === 'password' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{dict.reauth?.password || 'Password'}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-lg border border-border px-3 py-2 bg-background focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground">{dict.reauth?.cancel || 'Cancel'}</button>
              <button type="submit" disabled={loading || !password} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {loading ? dict.reauth?.verifying || 'Verifying...' : dict.reauth?.verify || 'Verify'}
              </button>
            </div>
          </form>
        )}

        {method === 'totp' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{dict.reauth?.sixDigitCode || '6-digit Code'}</label>
              <input
                type="text"
                required
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                className="block w-full tracking-widest text-center text-lg rounded-lg border border-border px-3 py-2 bg-background focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground">{dict.reauth?.cancel || 'Cancel'}</button>
              <button type="submit" disabled={loading || totpCode.length < 6} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {loading ? dict.reauth?.verifying || 'Verifying...' : dict.reauth?.verify || 'Verify'}
              </button>
            </div>
          </form>
        )}

        {method === 'passkey' && (
          <div className="text-center py-4 space-y-4">
            <p className="text-sm text-muted">{dict.reauth?.waitingPasskey || 'Waiting for passkey verification...'}</p>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground">{dict.reauth?.cancel || 'Cancel'}</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

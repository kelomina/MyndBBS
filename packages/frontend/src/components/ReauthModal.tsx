import React, { useState, useEffect } from 'react';
import { useTranslation } from './TranslationProvider';
import { usePasskey } from '../lib/hooks/usePasskey';

interface ReauthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReauthModal({ isOpen, onClose, onSuccess }: ReauthModalProps) {
  const dict = useTranslation();
  const [method, setMethod] = useState<'password' | 'totp' | 'passkey'>('password');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableMethods, setAvailableMethods] = useState<{ hasTotp: boolean, hasPasskey: boolean }>({ hasTotp: false, hasPasskey: false });
  const { executePasskeyFlow, passkeyLoading, passkeyError, setPasskeyError } = usePasskey();

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
            setAvailableMethods({ hasTotp: data.user.isTotpEnabled, hasPasskey: data.user._count?.passkeys > 0 });
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
            if (!isCancel) setError(err.message || 'Passkey verification failed');
            setLoading(false);
          }
        );
        return; // executePasskeyFlow handles its own loading state
      }

      const res = await fetch('/api/v1/user/sudo/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: method, password: method === 'password' ? password : undefined, totpCode: method === 'totp' ? totpCode : undefined })
      });

      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        setError(dict.apiErrors?.[data.error] || data.error || 'Verification failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      if (method !== 'passkey') {
        setLoading(false);
      }
    }
  };

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
        if (!isCancel) setError(err.message || 'Passkey verification failed');
        setLoading(false);
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border border-border/50">
        <h3 className="text-xl font-bold text-foreground mb-2">Verify it&apos;s you</h3>
        <p className="text-sm text-muted mb-6">Please confirm your identity to continue.</p>

        {(error || passkeyError) && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {error || passkeyError}
          </div>
        )}

        <div className="flex gap-2 mb-6">
          <button 
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${method === 'password' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            onClick={() => setMethod('password')}
          >
            Password
          </button>
          {availableMethods.hasTotp && (
            <button 
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${method === 'totp' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              onClick={() => setMethod('totp')}
            >
              Authenticator App
            </button>
          )}
          {availableMethods.hasPasskey && (
            <button 
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${method === 'passkey' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              onClick={handlePasskeyClick}
            >
              Passkey
            </button>
          )}
        </div>

        {method === 'password' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-lg border border-border px-3 py-2 bg-background focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground">Cancel</button>
              <button type="submit" disabled={loading || !password} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </form>
        )}

        {method === 'totp' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">6-digit Code</label>
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
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground">Cancel</button>
              <button type="submit" disabled={loading || totpCode.length < 6} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </form>
        )}

        {method === 'passkey' && (
          <div className="text-center py-4 space-y-4">
            <p className="text-sm text-muted">Waiting for passkey verification...</p>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground">Cancel</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

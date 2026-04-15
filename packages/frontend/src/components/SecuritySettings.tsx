'use client';

import React, { useState, useEffect } from 'react';
import { Fingerprint, Smartphone, Trash2 } from 'lucide-react';
import { usePasskey } from '../lib/hooks/usePasskey';
import { TwoFactorSetup } from './TwoFactorSetup';
import { useTranslation } from './TranslationProvider';
import { ReauthModal } from './ReauthModal';

/**
 * Callers: []
 * Callees: [useTranslation, useState, usePasskey, useEffect, fetchSecurityData, all, fetch, json, setTotpEnabled, setPasskeys, error, setLoading, action, setPendingAction, setShowReauth, setError, setMessage, setPasskeyError, executePasskeyFlow, confirm, filter, pendingAction, map, toLocaleDateString, executeWithSudo, handleDeletePasskey, setShowTotpSetup]
 * Description: Handles the security settings logic for the application.
 * Keywords: securitysettings, security, settings, auto-annotated
 */
export function SecuritySettings() {
  const dict = useTranslation();
  const [passkeys, setPasskeys] = useState<{ id: string; deviceType: string; createdAt: string }[]>([]);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [showReauth, setShowReauth] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const { executePasskeyFlow, passkeyError, setPasskeyError } = usePasskey();

  useEffect(() => {
    fetchSecurityData();
  }, []);

  /**
     * Callers: []
     * Callees: [all, fetch, json, setTotpEnabled, setPasskeys, error, setLoading]
     * Description: Handles the fetch security data logic for the application.
     * Keywords: fetchsecuritydata, fetch, security, data, auto-annotated
     */
    const fetchSecurityData = async () => {
    try {
      const [profileRes, passkeysRes] = await Promise.all([
        fetch('/api/v1/user/profile', { credentials: 'include' }),
        fetch('/api/v1/user/passkeys', { credentials: 'include' })
      ]);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setTotpEnabled(profileData.user.isTotpEnabled);
      }

      if (passkeysRes.ok) {
        const passkeysData = await passkeysRes.json();
        setPasskeys(passkeysData.passkeys);
      }
    } catch (err) {
      console.error('Failed to fetch security data', err);
    } finally {
      setLoading(false);
    }
  };

  /**
     * Callers: []
     * Callees: [fetch, json, action, setPendingAction, setShowReauth, setError]
     * Description: Handles the execute with sudo logic for the application.
     * Keywords: executewithsudo, execute, with, sudo, auto-annotated
     */
    const executeWithSudo = async (action: () => void) => {
    try {
      const res = await fetch('/api/v1/user/sudo/check', { credentials: 'include' });
      const data = await res.json();
      if (data.isSudo) {
        action();
      } else {
        setPendingAction(() => action);
        setShowReauth(true);
      }
    } catch {
      setError('Network error');
    }
  };

  /**
     * Callers: []
     * Callees: [setError, setMessage, setPasskeyError, executePasskeyFlow, fetchSecurityData]
     * Description: Handles the handle add passkey logic for the application.
     * Keywords: handleaddpasskey, handle, add, passkey, auto-annotated
     */
    const handleAddPasskey = async () => {
    setError('');
    setMessage('');
    setPasskeyError('');
    executePasskeyFlow(
      'register',
      '/api/v1/user/passkey/generate-registration-options',
      '/api/v1/user/passkey/verify-registration',
      dict,
      () => {
        setMessage(dict.settings.passkeyAdded);
        fetchSecurityData();
      }
    );
  };

  /**
     * Callers: []
     * Callees: [confirm, fetch, setPasskeys, filter, setMessage, setError]
     * Description: Handles the handle delete passkey logic for the application.
     * Keywords: handledeletepasskey, handle, delete, passkey, auto-annotated
     */
    const handleDeletePasskey = async (id: string) => {
    if (!confirm(dict.settings.confirmRemovePasskey)) return;
    
    try {
      const res = await fetch(`/api/v1/user/passkeys/${id}`, {
        method: 'DELETE',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'include'
      });
      if (res.ok) {
        setPasskeys(passkeys.filter(pk => pk.id !== id));
        setMessage(dict.settings.passkeyRemoved);
      } else {
        throw new Error('Failed to remove passkey');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  /**
     * Callers: []
     * Callees: [confirm, fetch, setTotpEnabled, setMessage, setError]
     * Description: Handles the handle disable totp logic for the application.
     * Keywords: handledisabletotp, handle, disable, totp, auto-annotated
     */
    const handleDisableTotp = async () => {
    if (!confirm(dict.settings.confirmDisableTotp)) return;
    
    try {
      const res = await fetch('/api/v1/user/totp/disable', {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'include'
      });
      if (res.ok) {
        setTotpEnabled(false);
        setMessage(dict.settings.totpDisabled);
      } else {
        throw new Error('Failed to disable TOTP');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) return <div className="text-sm text-muted">{dict.settings.loadingSecurity}</div>;

  return (
    <>
      <ReauthModal 
        isOpen={showReauth} 
        onClose={() => setShowReauth(false)} 
        onSuccess={() => {
          setShowReauth(false);
          if (pendingAction) pendingAction();
        }} 
      />
      <div className="rounded-xl bg-card p-6 shadow-sm border border-border/50">
      <h2 className="text-xl font-bold text-foreground mb-1">{dict.profile.securityPasskeys}</h2>
      <p className="text-sm text-muted mb-6">{dict.settings.manageSecurity}</p>

      {message && <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/30 dark:text-green-400">{message}</div>}
      {(error || passkeyError) && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">{error || passkeyError}</div>}

      <div className="space-y-8">
        {/* Passkeys */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-4">{dict.settings.passkeys}</h3>
          <p className="text-sm text-muted mb-4">{dict.settings.passkeysDesc}</p>
          
          <div className="space-y-3 mb-4">
            {passkeys.length === 0 ? (
              <p className="text-sm text-muted italic">{dict.settings.noPasskeys}</p>
            ) : (
              passkeys.map(pk => (
                <div key={pk.id} className="rounded-lg border border-border bg-background p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Fingerprint className="h-8 w-8 text-primary" />
                    <div>
                      <div className="text-sm font-medium text-foreground">{pk.deviceType} Passkey</div>
                      <div className="text-xs text-muted">{dict.settings.added} {new Date(pk.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => executeWithSudo(() => handleDeletePasskey(pk.id))}
                    className="p-2 text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                    title={dict.settings.removePasskey}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <button 
            onClick={() => executeWithSudo(handleAddPasskey)}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-background transition-colors"
          >
            <Fingerprint className="h-4 w-4" /> {dict.settings.addNewPasskey}
          </button>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="text-sm font-medium text-foreground mb-4">{dict.settings.totpTitle}</h3>
          <p className="text-sm text-muted mb-4">{dict.settings.totpDesc}</p>
          
          {totpEnabled ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-center justify-between dark:border-green-900/30 dark:bg-green-900/10 mb-4">
              <div className="flex items-center gap-3">
                <Smartphone className="h-8 w-8 text-green-600 dark:text-green-500" />
                <div>
                  <div className="text-sm font-medium text-green-800 dark:text-green-400">{dict.settings.totpEnabled}</div>
                  <div className="text-xs text-green-600/80 dark:text-green-500/80">{dict.settings.accountProtected}</div>
                </div>
              </div>
              <button 
                onClick={() => executeWithSudo(handleDisableTotp)}
                className="p-2 text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                title={dict.settings.disable || "Disable"}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div>
              {!showTotpSetup ? (
                <button 
                  onClick={() => executeWithSudo(() => setShowTotpSetup(true))}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-background transition-colors"
                >
                  <Smartphone className="h-4 w-4" /> {dict.settings.enableTotp}
                </button>
              ) : (
                <div className="mt-4 border border-border rounded-lg p-6 bg-background">
                  <TwoFactorSetup context="user" forceTotp={true} onComplete={() => {
                    setTotpEnabled(true);
                    setShowTotpSetup(false);
                    setMessage('Authenticator App enabled successfully');
                  }} />
                  <button 
                    onClick={() => setShowTotpSetup(false)}
                    className="mt-4 text-sm text-muted hover:text-foreground"
                  >
                    Cancel Setup
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

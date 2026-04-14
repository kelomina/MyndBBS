'use client';

import React, { useState, useEffect } from 'react';
import { User, Mail, Lock } from 'lucide-react';
import { useTranslation } from './TranslationProvider';
import { isValidPassword } from '@myndbbs/shared';
import { ReauthModal } from './ReauthModal';
import { fetcher } from '../lib/api/fetcher';

/**
 * Callers: []
 * Callees: [useTranslation, useState, fetcher, setProfile, setEmail, setUsername, setError, setLoading, useEffect, fetchProfile, setSaving, fetch, stringify, json, setPendingUpdate, setShowReauth, setMessage, setTimeout, setPassword, preventDefault, isValidPassword, keys, executeUpdate]
 * Description: Handles the profile settings logic for the application.
 * Keywords: profilesettings, profile, settings, auto-annotated
 */
export function ProfileSettings() {
  const dict = useTranslation();
  const [profile, setProfile] = useState<{ email: string; username: string } | null>(null);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showReauth, setShowReauth] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<any>(null);

  /**
     * Callers: []
     * Callees: [fetcher, setProfile, setEmail, setUsername, setError, setLoading]
     * Description: Handles the fetch profile logic for the application.
     * Keywords: fetchprofile, fetch, profile, auto-annotated
     */
    const fetchProfile = async () => {
    try {
      const data = await fetcher('/api/v1/user/profile');
      if (data.user) {
        setProfile(data.user);
        setEmail(data.user.email);
        setUsername(data.user.username);
      } else {
        setError(dict.settings.failedLoadProfile);
      }
    } catch (err) {
      const errorKey = err instanceof Error ? err.message : '';
      setError(dict.apiErrors?.[errorKey] || dict.settings.failedLoadProfile);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  /**
     * Callers: []
     * Callees: [setSaving, fetch, stringify, json, setPendingUpdate, setShowReauth, setMessage, setTimeout, setProfile, setPassword, setError]
     * Description: Handles the execute update logic for the application.
     * Keywords: executeupdate, execute, update, auto-annotated
     */
    const executeUpdate = async (updateData: any) => {
      setSaving(true);
      const res = await fetch('/api/v1/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData)
      });
      const data = await res.json();
      if (res.status === 403 && data.error === 'ERR_SUDO_REQUIRED') {
        setPendingUpdate(updateData);
        setShowReauth(true);
        setSaving(false);
        return;
      }
      if (res.ok) {
        if (data.passwordChanged) {
          setMessage(dict.settings.passwordChangedRelogin || 'Password changed. Redirecting to login...');
          setTimeout(async () => {
            await fetch('/api/v1/auth/logout', { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' });
            window.location.href = '/login';
          }, 3000);
        } else {
          setMessage(dict.settings.profileUpdated);
          setProfile(data.user);
          setPassword('');
          setSaving(false);
        }
      } else {
        setError(dict.apiErrors?.[data.error] || data.error || dict.settings.failedUpdateProfile);
        setSaving(false);
      }
  };

  /**
     * Callers: []
     * Callees: [preventDefault, setMessage, setError, isValidPassword, keys, executeUpdate]
     * Description: Handles the handle submit logic for the application.
     * Keywords: handlesubmit, handle, submit, auto-annotated
     */
    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (password && !isValidPassword(password)) {
      setError(dict.auth.passwordComplexityError);
      return;
    }

    const updateData: { email?: string; username?: string; password?: string } = {};
    if (email !== profile?.email) updateData.email = email;
    if (username !== profile?.username) updateData.username = username;
    if (password) updateData.password = password;

    if (Object.keys(updateData).length === 0) {
      return;
    }

    await executeUpdate(updateData);
  };

  if (loading) return <div className="text-sm text-muted">{dict.settings.loadingProfile}</div>;

  return (
    <>
      <ReauthModal isOpen={showReauth} onClose={() => setShowReauth(false)} onSuccess={() => {
        setShowReauth(false);
        if (pendingUpdate) executeUpdate(pendingUpdate);
      }} />
    <div className="rounded-xl bg-card p-6 shadow-sm border border-border/50">
      <h2 className="text-xl font-bold text-foreground mb-1">{dict.profile.basicProfile}</h2>
      <p className="text-sm text-muted mb-6">{dict.settings.manageProfile}</p>

      {message && <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/30 dark:text-green-400">{message}</div>}
      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{dict.settings.username}</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <User className="h-4 w-4 text-muted" />
            </div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="block w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{dict.settings.email}</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Mail className="h-4 w-4 text-muted" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <label className="block text-sm font-medium text-foreground mb-1">{dict.settings.changePassword}</label>
          <p className="text-xs text-muted mb-2">{dict.settings.leaveBlankToKeep}</p>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Lock className="h-4 w-4 text-muted" />
            </div>
            <input
              type="password"
              placeholder={dict.settings.newPassword}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {saving ? dict.settings.saving : dict.settings.saveChanges}
        </button>
      </form>
    </div>
    </>
  );
}

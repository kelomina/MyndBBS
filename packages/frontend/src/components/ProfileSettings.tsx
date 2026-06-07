'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Mail, Lock, Camera, Trash2 } from 'lucide-react';
import { useTranslation } from './TranslationProvider';
import { isValidPassword } from '@myndbbs/shared';
import { ReauthModal } from './ReauthModal';
import { Avatar } from './Avatar';
import { fetcher, fetchWithAuth } from '../lib/api/fetcher';

export function ProfileSettings() {
  const dict = useTranslation();
  const [profile, setProfile] = useState<{ email: string; username: string; avatarUrl?: string | null } | null>(null);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showReauth, setShowReauth] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{ email?: string; username?: string; password?: string } | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = useCallback(async () => {
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
      setError(dict.apiErrors?.[errorKey as keyof typeof dict.apiErrors] || dict.settings.failedLoadProfile);
    } finally {
      setLoading(false);
    }
  }, [dict]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void fetchProfile();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [fetchProfile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError(dict.settings.avatarFileSizeLimit || 'Avatar file size must be under 2MB');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError(dict.settings.avatarFileTypeLimit || 'Only JPG, PNG, GIF, WebP formats are allowed');
      return;
    }

    setAvatarUploading(true);
    setMessage('');
    setError('');

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await fetchWithAuth('/api/v1/user/avatar', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setProfile(prev => prev ? { ...prev, avatarUrl: data.avatarUrl } : prev);
        window.dispatchEvent(new CustomEvent('profile-updated', { detail: { avatarUrl: data.avatarUrl } }));
        setMessage(dict.settings.avatarUploadSuccess || 'Avatar updated successfully');
      } else {
        setError(dict.apiErrors?.[data.error as keyof typeof dict.apiErrors] || dict.settings.avatarUploadFailed || 'Avatar upload failed');
      }
    } catch {
      setError(dict.settings.avatarUploadFailed || 'Avatar upload failed');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAvatarDelete = async () => {
    setAvatarUploading(true);
    setMessage('');
    setError('');

    try {
      const res = await fetchWithAuth('/api/v1/user/avatar', {
        method: 'DELETE',
      });

      if (res.ok) {
        setProfile(prev => prev ? { ...prev, avatarUrl: null } : prev);
        window.dispatchEvent(new CustomEvent('profile-updated', { detail: { avatarUrl: null } }));
        setMessage(dict.settings.avatarRemoveSuccess || 'Avatar removed');
      } else {
        const data = await res.json();
        setError(dict.apiErrors?.[data.error as keyof typeof dict.apiErrors] || dict.settings.avatarRemoveFailed || 'Failed to remove avatar');
      }
    } catch {
      setError(dict.settings.avatarRemoveFailed || 'Failed to remove avatar');
    } finally {
      setAvatarUploading(false);
    }
  };

  const executeUpdate = async (updateData: { email?: string; username?: string; password?: string }) => {
      setSaving(true);
      const res = await fetchWithAuth('/api/v1/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
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
            await fetchWithAuth('/api/v1/auth/logout', { method: 'POST' });
            window.location.href = '/login';
          }, 3000);
        } else {
          setMessage(dict.settings.profileUpdated);
          setProfile(data.user);
          setPassword('');
          setSaving(false);
        }
      } else {
        setError(dict.apiErrors?.[data.error as keyof typeof dict.apiErrors] || data.error || dict.settings.failedUpdateProfile);
        setSaving(false);
      }
  };

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

      <div className="mb-6 flex items-center gap-4">
        <Avatar src={profile?.avatarUrl} username={profile?.username || ''} size={72} />
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleAvatarUpload}
            className="hidden"
          />
          <button
            type="button"
            disabled={avatarUploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5" />
            {dict.settings.changeAvatar || 'Change Avatar'}
          </button>
          {profile?.avatarUrl && (
            <button
              type="button"
              disabled={avatarUploading}
              onClick={handleAvatarDelete}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-destructive hover:border-destructive transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {dict.settings.removeAvatar || 'Remove'}
            </button>
          )}
        </div>
      </div>

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

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Settings, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useTranslation } from '../../../components/TranslationProvider';

import { Mail } from 'lucide-react';
/**
 * Callers: []
 * Callees: [useState, useRouter, useTranslation, useEffect, fetch, json, setCurrentUser, checkOwner, setIsLoggingOut, error]
 * Description: Handles the owner settings button logic for the application.
 * Keywords: ownersettingsbutton, owner, settings, button, auto-annotated
 */
export function OwnerSettingsButton({ username }: { username: string }) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const dict = useTranslation();

  useEffect(() => {
    /**
       * Callers: []
       * Callees: [fetch, json, setCurrentUser]
       * Description: Handles the check owner logic for the application.
       * Keywords: checkowner, check, owner, auto-annotated
       */
      const checkOwner = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/user/profile`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
        }
      } catch (err) {
        // ignore
      }
    };
    checkOwner();
  }, [username]);

  /**
     * Callers: []
     * Callees: [setIsLoggingOut, fetch, error]
     * Description: Handles the handle logout logic for the application.
     * Keywords: handlelogout, handle, logout, auto-annotated
     */
    const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include'
      });
      // Force a full page reload to clear all client-side state
      window.location.href = '/';
    } catch (err) {
      console.error('Logout failed', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!currentUser) return null;
  const isOwner = currentUser.username === username;

  return (
    <div className="flex gap-2">
      {!isOwner && currentUser.level >= 2 && (
        <Link
          href={`/messages/${username}`}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Mail className="h-4 w-4" />
          {dict.messages?.title || 'Send Message'}
        </Link>
      )}
      {isOwner && (<>
      <Link 
        href="/u/settings" 
        className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
      >
        <Settings className="h-4 w-4" />
        {dict.common?.settings || 'Settings'}
      </Link>
      <button 
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/80 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        {isLoggingOut ? '...' : dict.common?.logout || 'Logout'}
      </button>
      </>)}
    </div>
  );
}
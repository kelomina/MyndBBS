'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Settings, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function OwnerSettingsButton({ username, label }: { username: string, label: string }) {
  const [isOwner, setIsOwner] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkOwner = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/user/profile`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user?.username === username) {
            setIsOwner(true);
          }
        }
      } catch (err) {
        // ignore
      }
    };
    checkOwner();
  }, [username]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth/logout`, {
        method: 'POST',
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

  if (!isOwner) return null;

  return (
    <div className="flex gap-2">
      <Link 
        href="/u/settings" 
        className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
      >
        <Settings className="h-4 w-4" />
        {label}
      </Link>
      <button 
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/80 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        {isLoggingOut ? '...' : 'Logout'}
      </button>
    </div>
  );
}
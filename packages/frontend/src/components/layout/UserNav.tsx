'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { User, Loader2, PenSquare, Mail } from 'lucide-react';

export function UserNav({ title, newPostText, messagesText }: { title: string; newPostText?: string; messagesText?: string }) {
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = () => {
    fetch('/api/v1/messages/unread', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(d => setUnreadCount(d.count || 0))
      .catch(() => setUnreadCount(0));
  };

  useEffect(() => {
    const handleUnreadUpdate = () => fetchUnreadCount();
    window.addEventListener('messages-read', handleUnreadUpdate);
    window.addEventListener('messages-received', handleUnreadUpdate);

    return () => {
      window.removeEventListener('messages-read', handleUnreadUpdate);
      window.removeEventListener('messages-received', handleUnreadUpdate);
    };
  }, []);

  useEffect(() => {
    fetch('/api/v1/user/profile', { credentials: 'include' })
      .then(res => {
        if (res.ok) {
          return res.json();
        }
        throw new Error('Not authenticated');
      })

      .then(data => {
        setUser(data.user);
        fetchUnreadCount();
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (user) {
    return (
      <>
        {newPostText && (
          <Link
            href="/compose"
            className="hidden sm:flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <PenSquare className="mr-2 h-4 w-4" />
            {newPostText}
          </Link>
        )}
        <Link
          href="/messages"
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:bg-background hover:text-foreground"
          title={messagesText || 'Messages & Notifications'}
        >
          <Mail className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
        <Link
          href={`/u/${user.username}`}
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-primary bg-primary text-primary-foreground transition-transform hover:scale-105 uppercase font-bold text-sm"
          title={title}
        >
          {user.username.charAt(0)}
        </Link>
      </>
    );
  }

  return (
    <Link
      href="/login"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:bg-background hover:text-foreground"
      title={title}
    >
      <User className="h-5 w-5" />
      <span className="sr-only">{title}</span>
    </Link>
  );
}

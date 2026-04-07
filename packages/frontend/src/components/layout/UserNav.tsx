'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { User, Loader2 } from 'lucide-react';

export function UserNav({ title }: { title: string }) {
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [loading, setLoading] = useState(true);

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
      <Link
        href="/u/settings"
        className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-primary bg-primary text-primary-foreground transition-transform hover:scale-105 uppercase font-bold text-sm"
        title={title}
      >
        {user.username.charAt(0)}
      </Link>
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

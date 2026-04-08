'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Settings } from 'lucide-react';

export function OwnerSettingsButton({ username, label }: { username: string, label: string }) {
  const [isOwner, setIsOwner] = useState(false);

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

  if (!isOwner) return null;

  return (
    <Link 
      href="/u/settings" 
      className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
    >
      <Settings className="h-4 w-4" />
      {label}
    </Link>
  );
}
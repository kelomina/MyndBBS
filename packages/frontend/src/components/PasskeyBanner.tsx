'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslation } from './TranslationProvider';
import { fetcher } from '../lib/api/fetcher';
import { usePathname } from 'next/navigation';

export function PasskeyBanner() {
  const dict = useTranslation();
  const [show, setShow] = useState(false);
  const [closed, setClosed] = useState(false);
  const pathname = usePathname();
  const excluded =
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/admin-setup') ||
    pathname?.startsWith('/install');

  useEffect(() => {
    if (excluded) return;
    let cancelled = false;

    fetcher('/api/v1/user/profile')
      .then(data => {
        if (cancelled) return;
        if (data?.user) {
          if (data.user._count?.passkeys === 0) {
            setShow(true);
          } else {
            setShow(false);
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        setShow(false);
      });
    return () => {
      cancelled = true;
    };
  }, [excluded]);

  if (excluded || !show || closed) return null;

  return (
    <div className="bg-destructive text-destructive-foreground relative z-[60]">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8 flex items-start sm:items-center justify-between">
        <div className="flex items-start sm:items-center">
          <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5 sm:mt-0" />
          <p className="text-sm font-medium leading-5">
            {dict.common?.passkeyBannerText || "For account security, binding a Passkey is required. You have not bound a Passkey, so your account is restricted to Level 1 and cannot receive any level promotions."}
            <Link href="/u/settings" className="font-bold underline hover:text-white/80 ml-2 inline-block">
              {dict.common?.passkeyBannerLink || "Bind Passkey Now"}
            </Link>
          </p>
        </div>
        <button 
          onClick={() => setClosed(true)} 
          className="ml-4 flex-shrink-0 text-destructive-foreground hover:text-white/80 focus:outline-none"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

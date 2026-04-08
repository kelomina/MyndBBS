'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    // Refresh the current route on mount to ensure fresh data
    router.refresh();
  }, [router]);

  return null;
}
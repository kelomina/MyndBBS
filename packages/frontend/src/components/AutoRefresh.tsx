'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Callers: []
 * Callees: [useRouter, useEffect, refresh]
 * Description: Handles the auto refresh logic for the application.
 * Keywords: autorefresh, auto, refresh, auto-annotated
 */
export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    // Refresh the current route on mount to ensure fresh data
    router.refresh();
  }, [router]);

  return null;
}
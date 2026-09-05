'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AutoRefresh({ paused = false }: { paused?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    // 限流态暂停自动刷新，避免放大后端计数（F2）
    if (paused) return;
    // Refresh the current route on mount to ensure fresh data
    router.refresh();
  }, [router, paused]);

  return null;
}
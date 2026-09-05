'use client';

import React from 'react';
import { PostList } from './PostList';
import { RateLimitCard } from './RateLimitCard';
import { RateLimitUnlockModal } from './RateLimitUnlockModal';
import { useRateLimitRetry } from '../lib/rate-limit/use-rate-limit';
import { useToast } from './ui/Toast';
import type { Dictionary, PostListPost } from '../types';

interface PostListRateLimitIslandProps {
  initialRetryAfterSec: number;
  /** BFF 相对路径（经代理透传，如 /api/posts?sortBy=latest），禁止直拼后端 URL */
  bffUrl: string;
  emptyMessage: string;
  dict: Dictionary;
}

/**
 * SSR→Client 状态桥（F2）：RSC 把 rateLimited/retryAfter 经 props 交给本 Client Island，
 * 水合后接管倒计时 + 弹窗 + 附 X-RateLimit-Unlock 头重试一次（fetcher 自动附头）。
 */
export function PostListRateLimitIsland({ initialRetryAfterSec, bffUrl, emptyMessage, dict }: PostListRateLimitIslandProps) {
  const { toast } = useToast();
  const rl = (dict.rateLimitUnlock ?? {}) as unknown as Record<string, string>;
  const {
    limited,
    retryAfterSec,
    modalOpen,
    setModalOpen,
    retrying,
    data,
    handleRetry,
    handleUnlocked,
    openVerify,
  } = useRateLimitRetry<PostListPost[]>(bffUrl, initialRetryAfterSec);

  const onUnlocked = React.useCallback(
    (info: { exemptMinutes: number; expiresAt: string }) => {
      void info;
      toast(rl.unlockSuccess || 'Verified — access restored', 'success');
      handleUnlocked();
    },
    [toast, rl.unlockSuccess, handleUnlocked],
  );

  const onRetryClick = React.useCallback(() => {
    void handleRetry();
  }, [handleRetry]);

  // 恢复后渲染列表；未恢复渲染限流卡（data-testid 与空态零复用）
  if (!limited && data) {
    return <PostList posts={data} emptyMessage={emptyMessage} dict={dict} />;
  }

  return (
    <>
      <RateLimitCard
        key={retryAfterSec}
        retryAfterSec={retryAfterSec}
        onVerifyClick={openVerify}
        onRetryClick={onRetryClick}
        dict={dict}
        retrying={retrying}
      />
      {modalOpen && (
        <RateLimitUnlockModal
          isOpen
          onClose={() => setModalOpen(false)}
          retryAfterSec={retryAfterSec}
          onUnlocked={onUnlocked}
          dict={dict}
        />
      )}
    </>
  );
}

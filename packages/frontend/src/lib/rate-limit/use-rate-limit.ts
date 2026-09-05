'use client';

import React from 'react';
import { fetcher, RateLimitError } from '../api/fetcher';
import { getValidUnlockToken } from './unlock-token';

/**
 * 限流重试 Hook（F2）。
 * 封装“附 X-RateLimit-Unlock 头重试一次”语义：fetcher 已自动附头（unlock-token store），此处仅做一次重试编排。
 * - 初次挂载时若本地已有有效 token，自动试一次（免二次验证，SSR 首击无 token 但水合后有 token 的场景）。
 * - 手动重试（倒计时归零后）与解锁成功后各限 1 次自动重试；仍 429 则回落卡片 + 刷新倒计时，不循环。
 */
export function useRateLimitRetry<T>(bffUrl: string, initialRetryAfterSec: number) {
  const [limited, setLimited] = React.useState(true);
  const [retryAfterSec, setRetryAfterSec] = React.useState(
    Number.isFinite(initialRetryAfterSec) && initialRetryAfterSec > 0 ? Math.floor(initialRetryAfterSec) : 60,
  );
  const [modalOpen, setModalOpen] = React.useState(false);
  const [retrying, setRetrying] = React.useState(false);
  const [data, setData] = React.useState<T | null>(null);
  const autoTriedRef = React.useRef(false);

  const doFetchOnce = React.useCallback(async (): Promise<T> => {
    // fetcher 自动附 X-RateLimit-Unlock（若本地有有效 token），BFF 相对路径经代理透传
    return (await fetcher(bffUrl)) as T;
  }, [bffUrl]);

  const handleRetry = React.useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      const result = await doFetchOnce();
      setData(result);
      setLimited(false);
    } catch (err) {
      if (err instanceof RateLimitError) {
        setRetryAfterSec(err.retryAfterSec);
        setLimited(true);
      } else {
        // 非限流错误（如网络/404）也保持限流卡，避免误渲染空态；调用方可按需扩展
        const maybe = err as Error & { retryAfterSec?: number };
        if (typeof maybe.retryAfterSec === 'number') setRetryAfterSec(maybe.retryAfterSec);
        setLimited(true);
      }
    } finally {
      setRetrying(false);
    }
  }, [doFetchOnce, retrying]);

  // 水合后若已有有效 token，下一帧自动试一次（免二次验证；经 setTimeout  defer，避免 effect 体内同步 setState）。
  React.useEffect(() => {
    if (autoTriedRef.current) return;
    autoTriedRef.current = true;
    if (!getValidUnlockToken()) return;
    const id = window.setTimeout(() => {
      void handleRetry();
    }, 0);
    return () => window.clearTimeout(id);
  }, [handleRetry]);

  const handleUnlocked = React.useCallback(() => {
    setModalOpen(false);
    void handleRetry();
  }, [handleRetry]);

  const openVerify = React.useCallback(() => setModalOpen(true), []);

  return {
    limited,
    retryAfterSec,
    modalOpen,
    setModalOpen,
    retrying,
    data,
    handleRetry,
    handleUnlocked,
    openVerify,
  };
}

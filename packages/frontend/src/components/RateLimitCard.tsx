'use client';

import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button } from './ui/Button';
import { useTranslation } from './TranslationProvider';
import type { Dictionary } from '../types';

interface RateLimitCardProps {
  retryAfterSec: number;
  onVerifyClick: () => void;
  onRetryClick: () => void;
  /** 来自 RSC 的字典（公开页经 props 注入）；缺省时回退 useTranslation */
  dict?: Dictionary;
  /** 倒计时归零后是否正在重试（禁用双按钮防抖） */
  retrying?: boolean;
}

function formatRetryText(template: string, sec: number): string {
  return template.replace('{sec}', String(sec));
}

/**
 * 限流提示卡（F1/F2）。
 * 与“暂无帖子”空态零复用：独立 amber 视觉 + ShieldAlert + data-testid="ratelimit-card"（空态为 empty-state）。
 */
export function RateLimitCard({ retryAfterSec, onVerifyClick, onRetryClick, dict: dictProp, retrying = false }: RateLimitCardProps) {
  const hookDict = useTranslation();
  const dict = (dictProp ?? hookDict) as Dictionary;
  const rl = dict.rateLimitUnlock as unknown as Record<string, string>;

  const initial = Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? Math.floor(retryAfterSec) : 0;
  // 倒计时本地态：以挂载时 initial 为起点 1s 步进；retryAfterSec 更新时由父级经 key 强制 remount（避免 effect 内同步 setState）。
  const [remaining, setRemaining] = React.useState(initial);

  React.useEffect(() => {
    if (remaining <= 0) return;
    const id = window.setTimeout(() => setRemaining((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => window.clearTimeout(id);
  }, [remaining]);

  const canRetry = remaining <= 0 && !retrying;
  const countdownText =
    remaining > 0
      ? formatRetryText(rl.retryAfter || 'Retry available in {sec}s', remaining)
      : (rl.retryNow || 'Retry now');

  return (
    <div
      data-testid="ratelimit-card"
      role="alert"
      className="rounded-xl border border-amber-500/40 bg-amber-50 p-6 dark:bg-amber-950/20"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="font-semibold text-foreground">{rl.cardTitle || 'Too many requests — verify to continue'}</h2>
          <p className="text-sm text-muted">{rl.cardDesc || ''}</p>
          <div role="status" aria-live="polite" className="text-sm text-muted">
            {countdownText}
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button type="button" onClick={onVerifyClick} disabled={retrying}>
              {rl.verifyToUnlock || 'Verify to unlock'}
            </Button>
            <Button type="button" variant="ghost" onClick={onRetryClick} disabled={!canRetry}>
              {rl.retryNow || 'Retry now'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

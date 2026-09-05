'use client';

import React from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { SliderCaptcha, type SliderCaptchaSolutionPayload } from './SliderCaptcha';
import { postUnlock, UnlockCooldownError, UnlockFailedError } from '../lib/rate-limit/unlock';
import { saveUnlockToken } from '../lib/rate-limit/unlock-token';
import { useTranslation } from './TranslationProvider';
import type { Dictionary } from '../types';

export type UnlockModalState = 'idle' | 'verifying' | 'success' | 'error' | 'cooldown';

interface RateLimitUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 来自 429 retryAfterSec，本地倒计时展示用 */
  retryAfterSec: number;
  /** 解锁凭证就绪 → 调用方重试原请求（最多 1 次自动重试） */
  onUnlocked: (info: { exemptMinutes: number; expiresAt: string }) => void;
  dict?: Dictionary;
}

function formatTemplate(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(`{${k}}`, String(v));
  }
  return out;
}

/**
 * 读限流解锁弹窗（F1）。
 * 复用 ui/Modal + 内嵌 SliderCaptcha（manual 直兑模式，不改现有 5 处调用的默认 /verify 流程）。
 * 五态 idle/verifying/success/error/cooldown；失败 1.5s 换题 + 常驻换一张按钮。
 */
export function RateLimitUnlockModal({ isOpen, onClose, retryAfterSec, onUnlocked, dict: dictProp }: RateLimitUnlockModalProps) {
  const hookDict = useTranslation();
  const dict = (dictProp ?? hookDict) as Dictionary;
  const rl = (dict.rateLimitUnlock ?? {}) as unknown as Record<string, string>;

  const [state, setState] = React.useState<UnlockModalState>('idle');
  const [errorText, setErrorText] = React.useState('');
  const [cooldownSec, setCooldownSec] = React.useState(0);
  const [challengeKey, setChallengeKey] = React.useState(0);
  const [exemptMinutes, setExemptMinutes] = React.useState<number | null>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const refreshTimerRef = React.useRef<number | null>(null);
  const cooldownTimerRef = React.useRef<number | null>(null);

  const clearTimers = React.useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (cooldownTimerRef.current !== null) {
      window.clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  }, []);

  // 挂载时聚焦滑块（a11y：初始焦点落在滑块；父级经条件渲染保证每次打开均为全新挂载，无需 effect 内同步 reset）。
  // 卸载时清理定时器。
  React.useEffect(() => {
    const id = window.setTimeout(() => {
      const slider = contentRef.current?.querySelector<HTMLInputElement>('input[type="range"]');
      slider?.focus({ preventScroll: true });
    }, 50);
    return () => {
      window.clearTimeout(id);
      clearTimers();
    };
  }, [clearTimers]);

  // cooldown 倒计时：1s 步进；归零过渡在 timeout 回调内完成（避免 effect 体内同步 setState）。
  React.useEffect(() => {
    if (state !== 'cooldown') return;
    if (cooldownSec <= 0) return;
    cooldownTimerRef.current = window.setTimeout(() => {
      if (cooldownSec <= 1) {
        setCooldownSec(0);
        setState('idle');
        setErrorText('');
        setChallengeKey((k) => k + 1);
      } else {
        setCooldownSec(cooldownSec - 1);
      }
    }, 1000);
    return () => {
      if (cooldownTimerRef.current !== null) window.clearTimeout(cooldownTimerRef.current);
    };
  }, [state, cooldownSec]);

  const scheduleRefresh = React.useCallback(() => {
    if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      setChallengeKey((k) => k + 1);
      setState((s) => (s === 'error' ? 'idle' : s));
      setErrorText('');
    }, 1500);
  }, []);

  const handleSolution = React.useCallback(
    async (captchaId: string, solution?: SliderCaptchaSolutionPayload) => {
      if (!solution) {
        setState('error');
        setErrorText(rl.unlockFailedRetry || 'Verification failed — try a new challenge');
        scheduleRefresh();
        return;
      }
      setState('verifying');
      setErrorText('');
      try {
        const result = await postUnlock({
          captchaId,
          dragPath: solution.dragPath,
          totalDragTime: solution.totalDragTime,
          finalPosition: solution.finalPosition,
        });
        saveUnlockToken({
          unlockToken: result.unlockToken,
          expiresAt: result.expiresAt,
          exemptMinutes: result.exemptMinutes,
        });
        setExemptMinutes(result.exemptMinutes);
        setState('success');
        onUnlocked({ exemptMinutes: result.exemptMinutes, expiresAt: result.expiresAt });
      } catch (err) {
        if (err instanceof UnlockCooldownError) {
          setState('cooldown');
          setCooldownSec(err.retryAfterSec);
          setErrorText('');
        } else {
          const code = err instanceof UnlockFailedError ? err.message : 'ERR_VERIFICATION_FAILED';
          const mapped =
            (dict.apiErrors as unknown as Record<string, string> | undefined)?.[code] ||
            rl.unlockFailedRetry ||
            'Verification failed — try a new challenge';
          setState('error');
          setErrorText(mapped);
          scheduleRefresh();
        }
      }
    },
    [dict.apiErrors, rl.unlockFailedRetry, onUnlocked, scheduleRefresh],
  );

  const handleManualRefresh = React.useCallback(() => {
    if (state === 'verifying') return;
    clearTimers();
    setErrorText('');
    if (state === 'cooldown') {
      // cooldown 未归零前不允许换题（Slider 禁用中）
      return;
    }
    setState('idle');
    setChallengeKey((k) => k + 1);
  }, [state, clearTimers]);

  const verifying = state === 'verifying';
  const cooling = state === 'cooldown';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={rl.modalTitle || 'Human verification'}
      describedBy="ratelimit-unlock-desc"
    >
      <div ref={contentRef} className="space-y-4">
        <p id="ratelimit-unlock-desc" className="text-sm text-muted">
          {rl.modalDesc || 'Drag the slider to prove you are human. You can close anytime.'}
        </p>

        {state === 'error' && errorText ? (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {errorText}
          </div>
        ) : null}

        {cooling ? (
          <div role="status" aria-live="polite" className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
            {formatTemplate(rl.retryAfter || 'Retry available in {sec}s', { sec: cooldownSec })}
          </div>
        ) : null}

        {state === 'success' && exemptMinutes !== null ? (
          <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-200">
            {(rl.unlockSuccess || 'Verified — access restored') +
              ' · ' +
              formatTemplate(rl.exemptedHint || 'Unlocked for {min} min on this network', { min: exemptMinutes })}
          </div>
        ) : null}

        {/* 滑块区：verifying/cooldown 时禁用（SliderCaptcha 内部 disabled + Modal 层 pointer-events 兜底） */}
        <div aria-busy={verifying || cooling} className={verifying || cooling ? 'pointer-events-none opacity-90' : undefined}>
          <SliderCaptcha key={challengeKey} manual apiUrl="/api/v1/auth" onSuccess={(id, sol) => void handleSolution(id, sol)} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={handleManualRefresh} disabled={verifying || cooling}>
            {rl.refreshChallenge || 'New challenge'}
          </Button>
          <span className="text-xs text-muted">
            {typeof retryAfterSec === 'number' && retryAfterSec > 0
              ? formatTemplate(rl.waitWithoutUnlock || 'Limit active — please wait {sec}s', { sec: retryAfterSec })
              : null}
          </span>
        </div>
      </div>
    </Modal>
  );
}

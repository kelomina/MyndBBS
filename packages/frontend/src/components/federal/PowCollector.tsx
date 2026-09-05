'use client';

import React from 'react';
import { Button } from '../ui/Button';
import { POW_WORKER_SOURCE, powHash, meetsLeadingZeroBits } from '../../lib/federal/sha256';

/**
 * PoW 收集器（02:00 演示批准增量组件化）。
 * - Worker 纯 JS SHA-256 + 进度 + 取消 + 10s 超时回落 slider-low + 降档重试。
 * - 必须用户手势触发（禁自动开算，防移动端 DoS 体感）；主线程仅进度条 + nonce 动画。
 * - bits 为服务端快照只读（防 farming）；降档重试 = 新挑战重算（同 bits 新 challenge），超限回落滑块由父切换。
 */

interface PowCollectorProps {
  challenge: string;
  bits: number;
  /** 超时秒，默认 10（冻结契约 timeoutSec 默认值硬编码；管理改值实时同步待 issue 增量字段，见 HANDOVER 观察项） */
  timeoutSec?: number;
  disabled?: boolean;
  dict?: Record<string, string>;
  onSolved?: (info: { nonce: string; hash: string; tried: number; sec: number }) => void;
  onTimeout?: (info: { tried: number; suggestedBits: number }) => void;
  onFallback?: () => void;
  onCancel?: () => void;
}

type PowState = 'idle' | 'mining' | 'success' | 'error' | 'timeout';

function formatTemplate(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, String(v));
  return out;
}

export function PowCollector({
  challenge,
  bits,
  timeoutSec = 10,
  disabled = false,
  dict = {},
  onSolved,
  onTimeout,
  onFallback,
  onCancel,
}: PowCollectorProps) {
  const t = React.useCallback((k: string, fb: string): string => dict[k] || fb, [dict]);
  const [state, setState] = React.useState<PowState>('idle');
  const [tried, setTried] = React.useState(0);
  const [rate, setRate] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);
  const [liveNonce, setLiveNonce] = React.useState('—');
  const [result, setResult] = React.useState<{ nonce: string; hash: string; tried: number; sec: number } | null>(null);
  const workerRef = React.useRef<Worker | null>(null);
  const timerRef = React.useRef<number | null>(null);
  const tickRef = React.useRef<number | null>(null);
  const startRef = React.useRef(0);
  const triedRef = React.useRef(0);
  const solvedRef = React.useRef(false);
  const fallbackTimerRef = React.useRef(false);

  const miningRef = React.useRef(false);

  const cleanup = React.useCallback(() => {
    miningRef.current = false;
    if (workerRef.current) {
      try {
        workerRef.current.terminate();
      } catch {
        // 忽略
      }
      workerRef.current = null;
    }
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  React.useEffect(() => cleanup, [cleanup]);

  // 挑战切换时重置（新 challenge 新解，nonce 无独立生命，换 challenge 即无效；经 setTimeout defer）
  React.useEffect(() => {
    const id = window.setTimeout(() => {
      cleanup();
      solvedRef.current = false;
      fallbackTimerRef.current = false;
      setState('idle');
      setTried(0);
      setRate(0);
      setElapsed(0);
      setLiveNonce('—');
      setResult(null);
    }, 0);
    return () => window.clearTimeout(id);
  }, [challenge, bits, cleanup]);

  const handleTimeout = React.useCallback(() => {
    if (solvedRef.current) return;
    cleanup();
    setState('timeout');
    const suggested = Math.max(8, bits - 4);
    onTimeout?.({ tried: triedRef.current, suggestedBits: suggested });
  }, [bits, cleanup, onTimeout]);

  const runOnMainThread = React.useCallback(
    async (
      startNonce: number,
      onProgress: (ns: string, n: number) => void,
      onFound: (ns: string, h: string, n: number) => void,
    ): Promise<void> => {
      let nonce = startNonce;
      let triedCount = 0;
      const CHUNK = 800;
      const step = (): void => {
        if (solvedRef.current) return;
        if (!miningRef.current) return;
        const nowMs = window.performance && window.performance.now ? window.performance.now() : Date.now();
        if ((nowMs - startRef.current) / 1000 > timeoutSec) {
          handleTimeout();
          return;
        }
        for (let i = 0; i < CHUNK; i++) {
          const ns = String(nonce);
          const h = powHash(challenge, ns);
          triedCount++;
          if (meetsLeadingZeroBits(h, bits)) {
            onFound(ns, h, triedCount);
            return;
          }
          nonce++;
        }
        onProgress(String(nonce), triedCount);
        window.setTimeout(step, 0);
      };
      step();
    },
    [bits, challenge, handleTimeout, timeoutSec],
  );

  const startMining = React.useCallback(() => {
    if (disabled || miningRef.current) return;
    cleanup();
    solvedRef.current = false;
    miningRef.current = true;
    triedRef.current = 0;
    setTried(0);
    setRate(0);
    setElapsed(0);
    setResult(null);
    setState('mining');
    startRef.current = window.performance && window.performance.now ? window.performance.now() : Date.now();
    const startNonce = Math.floor(Math.random() * 1000000);

    // 进度 tick（1s 步进，用 triedRef 估算 H/s）
    tickRef.current = window.setInterval(() => {
      const nowMs = window.performance && window.performance.now ? window.performance.now() : Date.now();
      const sec = (nowMs - startRef.current) / 1000;
      setElapsed(sec);
      if (sec > 0) setRate(Math.round(triedRef.current / Math.max(sec, 0.01)));
    }, 500);

    // 超时：terminate + 切 amber 超时态（不直接 400 锁死）
    timerRef.current = window.setTimeout(handleTimeout, timeoutSec * 1000);

    const onProgress = (nonceStr: string, triedCount: number): void => {
      triedRef.current = triedCount;
      setTried(triedCount);
      setLiveNonce(nonceStr);
      const nowMs = window.performance && window.performance.now ? window.performance.now() : Date.now();
      const sec = (nowMs - startRef.current) / 1000;
      setElapsed(sec);
      if (sec > 0.2) setRate(Math.round(triedCount / Math.max(sec, 0.01)));
    };

    const onFound = (nonceStr: string, hash: string, triedCount: number): void => {
      if (solvedRef.current) return;
      solvedRef.current = true;
      // 本地复算一次（同一函数口径，防止 Worker 投毒/截断误报；失败走 error 态）
      const rehash = powHash(challenge, nonceStr);
      if (rehash !== hash || !meetsLeadingZeroBits(hash, bits)) {
        cleanup();
        setState('error');
        return;
      }
      cleanup();
      const nowMs = window.performance && window.performance.now ? window.performance.now() : Date.now();
      const sec = (nowMs - startRef.current) / 1000;
      const info = { nonce: nonceStr, hash, tried: triedCount, sec };
      setResult(info);
      setState('success');
      onSolved?.(info);
    };

    // Worker 首选（chunked 分片 + 进度回调 + 可取消）；失败回落主线程分片（仍纯 JS，不阻塞超 50ms/片）
    try {
      const blob = new Blob([POW_WORKER_SOURCE], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);
      workerRef.current = worker;
      worker.onmessage = (ev: MessageEvent) => {
        const d = (ev.data || {}) as { type?: string; nonce?: string; hash?: string; tried?: number };
        if (d.type === 'found' && typeof d.nonce === 'string' && typeof d.hash === 'string') {
          onFound(d.nonce, d.hash, typeof d.tried === 'number' ? d.tried : triedRef.current);
          try {
            URL.revokeObjectURL(url);
          } catch {
            // 忽略
          }
        } else if (d.type === 'progress') {
          onProgress(typeof d.nonce === 'string' ? d.nonce : '—', typeof d.tried === 'number' ? d.tried : 0);
        }
      };
      worker.onerror = () => {
        // Worker 被 CSP/环境拒绝 → 回落主线程
        try {
          worker.terminate();
        } catch {
          // 忽略
        }
        workerRef.current = null;
        try {
          URL.revokeObjectURL(url);
        } catch {
          // 忽略
        }
        void runOnMainThread(startNonce, onProgress, onFound);
      };
      worker.postMessage({ challenge, bits, startNonce, chunk: 1200, hexNonce: false });
    } catch {
      void runOnMainThread(startNonce, onProgress, onFound);
    }
  }, [challenge, bits, disabled, timeoutSec, cleanup, handleTimeout, runOnMainThread, onSolved]);

  const handleCancel = React.useCallback(() => {
    cleanup();
    solvedRef.current = false;
    miningRef.current = false;
    setState('idle');
    setTried(0);
    setRate(0);
    setElapsed(0);
    onCancel?.();
  }, [cleanup, onCancel]);

  const mining = state === 'mining';
  const suggestedBits = Math.max(8, bits - 4);
  const pct = Math.min(100, (elapsed / timeoutSec) * 100);

  return (
    <div>
      <p className="mono text-[13px] text-slate-200">
        {formatTemplate(t('challenge', 'Challenge {ch} · difficulty {bits} bits · limit 10s'), {
          ch: `${challenge.slice(0, 10)}…${challenge.slice(-6)}`,
          bits,
        })}
      </p>
      <div className="row mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" onClick={startMining} disabled={disabled || mining}>
          {t('start', 'Start computing')}
        </Button>
        <Button type="button" variant="destructive" onClick={handleCancel} disabled={!mining}>
          {t('cancel', 'Cancel')}
        </Button>
        {state === 'timeout' && (
          <Button type="button" variant="ghost" onClick={startMining} disabled={disabled}>
            {t('downgrade', 'Retry lower (bits−4)')}
          </Button>
        )}
      </div>
      <div className="progress mt-2 h-3 overflow-hidden rounded-full bg-slate-500/30" aria-hidden="true">
        <i className={mining ? 'stripes block h-full rounded-full bg-sky-500' : 'block h-full rounded-full bg-sky-500'} style={{ width: `${pct}%` }} />
      </div>
      <p className="mono nonce-live mt-1 text-[13px] text-slate-200" aria-hidden="true">
        nonce {liveNonce} · {rate} H/s
      </p>
      {state === 'mining' && (
        <div role="status" aria-live="polite" className="mt-2 text-sm text-slate-200">
          {formatTemplate(t('mining', 'Mining… tried {tried} · {rate} H/s · {sec}s elapsed'), {
            tried,
            rate,
            sec: elapsed.toFixed(1),
          })}
        </div>
      )}
      {state === 'success' && result && (
        <div role="status" className="mt-2 rounded-md border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
          {formatTemplate(t('success', 'Work verified — threshold met: nonce={nonce}, {bits} bits, {sec}s.'), {
            nonce: result.nonce,
            bits,
            sec: result.sec.toFixed(1),
          })}
        </div>
      )}
      {state === 'error' && (
        <div role="alert" className="mt-2 rounded-md border border-rose-500/40 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-200">
          {t('failed', 'Verification failed: hash misses difficulty.')}
        </div>
      )}
      {state === 'timeout' && (
        <div role="alert" className="mt-2 rounded-md border border-rose-500/40 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-200">
          {formatTemplate(t('timeout', 'Timed out (>10s) — retry or lower difficulty. Suggested: {bits} bits.'), {
            bits: suggestedBits,
          })}
        </div>
      )}
      {(state === 'timeout' || state === 'error') && onFallback && (
        <div className="mt-2 rounded-xl border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
          <strong>{t('degraded', 'Too slow — falls back to slider')}</strong>
          <div className="mt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onFallback}>
              {t('fallbackGo', 'Switch to slider')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

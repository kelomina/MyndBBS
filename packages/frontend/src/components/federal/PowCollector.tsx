'use client';

import React from 'react';
import { POW_WORKER_SOURCE, powHash, meetsLeadingZeroBits } from '../../lib/federal/sha256';

/**
 * PoW 收集器（COPY-CHANGE-1 v1.1 静默化 + 自动链）。
 * - PoW 卡面静默化：删挑战行/开始/取消/降档按钮与全部 pow.* 文案（D10–D26），仅保留进度条 + 纯数字 nonce 行 + 空态 role=status（D1/E2 由联邦 Modal 承接）。
 * - 自动链（§6）：Modal doIssue 成功回调（kind=pow）后挂载即自动开算，不经用户点击；
 *   challenge/bits 切换 effect 仅做重置（开算权唯一在 issue 成功回调，防 StrictMode 双 effect 双开）。
 * - 三重守卫防双开：captchaId+challenge 快照 + miningRef + solvedRef + autoStartSeq（Modal issueSeqRef 快照），同一 captchaId 重复触发直接 return。
 * - 超时 10s 双轨（timerRef + 主线程分片检查）→ 首次经 onTimeout 自动降档（bits-4，新 captchaId，计数 1）→ 再超时由 Modal 自动回落滑块（degraded+fallbackSlider）。
 * - bits 为服务端快照只读；本地复算防投毒；verify/超时竞态 solvedRef 优先，timeout 后 nonce 丢弃不调 verify。
 */

export interface PowCollectorHandle {
  startMining: () => void;
}

interface PowCollectorProps {
  challenge: string;
  bits: number;
  /** 挑战标识（§6.2 challengeId 守卫：captchaId+challenge 快照，同一 captchaId 重复触发直接 return；另与 Modal issueSeqRef + miningRef/solvedRef 构成三重守卫） */
  captchaId: string;
  /** 超时秒，默认 10（冻结契约 timeoutSec 默认值；管理改值实时同步待 issue 增量字段） */
  timeoutSec?: number;
  disabled?: boolean;
  onSolved?: (info: { nonce: string; hash: string; tried: number; sec: number }) => void;
  onTimeout?: (info: { tried: number; suggestedBits: number }) => void;
}

type PowState = 'idle' | 'mining' | 'success' | 'error' | 'timeout';

export const PowCollector = React.forwardRef<PowCollectorHandle, PowCollectorProps>(function PowCollector(
  { challenge, bits, captchaId, timeoutSec = 10, disabled = false, onSolved, onTimeout },
  ref,
) {
  const [state, setState] = React.useState<PowState>('idle');
  const [tried, setTried] = React.useState(0);
  const [rate, setRate] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);
  const [liveNonce, setLiveNonce] = React.useState('—');
  const workerRef = React.useRef<Worker | null>(null);
  const timerRef = React.useRef<number | null>(null);
  const tickRef = React.useRef<number | null>(null);
  const startRef = React.useRef(0);
  const triedRef = React.useRef(0);
  const solvedRef = React.useRef(false);
  const stateRef = React.useRef<PowState>('idle');
  const autoFiredRef = React.useRef<string | null>(null);

  const miningRef = React.useRef(false);

  const setPowState = React.useCallback((s: PowState) => {
    stateRef.current = s;
    setState(s);
  }, []);

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
  // 注意：本 effect 仅做重置，不自动开算（开算权唯一在 issue 成功回调的自动起算 effect，防 StrictMode 双 effect 双开）。
  React.useEffect(() => {
    const id = window.setTimeout(() => {
      cleanup();
      solvedRef.current = false;
      setPowState('idle');
      setTried(0);
      setRate(0);
      setElapsed(0);
      setLiveNonce('—');
    }, 0);
    return () => window.clearTimeout(id);
  }, [challenge, bits, captchaId, cleanup, setPowState]);

  const handleTimeout = React.useCallback(() => {
    if (solvedRef.current) return;
    if (stateRef.current === 'timeout') return;
    cleanup();
    setPowState('timeout');
    const suggested = Math.max(8, bits - 4);
    onTimeout?.({ tried: triedRef.current, suggestedBits: suggested });
  }, [bits, cleanup, onTimeout, setPowState]);

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
    // 三重守卫：captchaId+challenge 快照 + miningRef 单例 + solvedRef 已解 + Modal issueSeqRef（见 doIssue seq 守卫），同一 captchaId 重复触发直接 return（防双击/重渲染/StrictMode 双开算）
    if (disabled || miningRef.current) return;
    const curKey = `${captchaId}:${challenge}`;
    if (autoFiredRef.current === curKey && miningRef.current) return;
    autoFiredRef.current = curKey;
    cleanup();
    solvedRef.current = false;
    miningRef.current = true;
    triedRef.current = 0;
    setTried(0);
    setRate(0);
    setElapsed(0);
    setPowState('mining');
    startRef.current = window.performance && window.performance.now ? window.performance.now() : Date.now();
    const startNonce = Math.floor(Math.random() * 1000000);

    // 进度 tick（1s 步进，用 triedRef 估算 H/s）
    tickRef.current = window.setInterval(() => {
      const nowMs = window.performance && window.performance.now ? window.performance.now() : Date.now();
      const sec = (nowMs - startRef.current) / 1000;
      setElapsed(sec);
      if (sec > 0) setRate(Math.round(triedRef.current / Math.max(sec, 0.01)));
    }, 500);

    // 超时：terminate + 经 onTimeout 自动降档/回落（不直接 400 锁死；与分片内检查双轨，solvedRef 优先）
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
      // verify/超时竞态：已 timeout 则丢弃该 nonce（以 timeout 链为准），不调 verify
      if (stateRef.current === 'timeout') return;
      solvedRef.current = true;
      // 本地复算一次（同一函数口径，防止 Worker 投毒/截断误报；失败走 error 态，由 Modal E2 统一码承接）
      const rehash = powHash(challenge, nonceStr);
      if (rehash !== hash || !meetsLeadingZeroBits(hash, bits)) {
        cleanup();
        setPowState('error');
        return;
      }
      cleanup();
      const nowMs = window.performance && window.performance.now ? window.performance.now() : Date.now();
      const sec = (nowMs - startRef.current) / 1000;
      const info = { nonce: nonceStr, hash, tried: triedCount, sec };
      setPowState('success');
      onSolved?.(info);
    };

    // Worker 首选（chunked 分片 + 进度回调）；失败回落主线程分片（仍纯 JS，不阻塞超 50ms/片）
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
  }, [challenge, bits, captchaId, disabled, timeoutSec, cleanup, handleTimeout, runOnMainThread, onSolved, setPowState]);

  React.useImperativeHandle(ref, () => ({ startMining }), [startMining]);

  // 自动链：issue 成功回调（Modal doIssue kind=pow 成功，见 issueSeqRef seq 守卫）后挂载即自动开算，不经用户点击。
  // 开算权唯一在 issue 成功回调（本 effect 经 captchaId:challenge 触发，challenge/bits 切换重置 effect 不开算）。
  React.useEffect(() => {
    const key = `${captchaId}:${challenge}`;
    if (autoFiredRef.current === key) return;
    const id = window.setTimeout(() => {
      startMining();
    }, 0);
    return () => window.clearTimeout(id);
  }, [captchaId, challenge, startMining]);

  const mining = state === 'mining';
  const pct = Math.min(100, (elapsed / timeoutSec) * 100);

  // D1/E2 静默进度：仅进度条 + 纯数字 nonce 行 + 空态 role=status（无任何 pow.* 字典依赖；success/error/timeout/degraded 一律走 Modal E2）
  return (
    <div>
      <div className="progress mt-2 h-3 overflow-hidden rounded-full bg-slate-500/30" aria-hidden="true">
        <i className={mining ? 'stripes block h-full rounded-full bg-sky-500' : 'block h-full rounded-full bg-sky-500'} style={{ width: `${pct}%` }} />
      </div>
      <p className="mono nonce-live mt-1 text-[13px] text-slate-200" aria-hidden="true">
        nonce {liveNonce} · {rate} H/s
      </p>
      <div role="status" aria-live="polite" data-testid="pow-mining" className="sr-only">
        {mining ? `${tried} ${rate}` : ''}
      </div>
    </div>
  );
});

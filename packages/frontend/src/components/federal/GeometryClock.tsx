'use client';

import React from 'react';
import type { BehaviorSample } from '../../lib/federal/federal-api';

/**
 * 语义小时钟采集器（02:00 演示批准增量组件化，不拷贝演示整文件）。
 * - SVG 错序时钟：12 数字 Fisher-Yates 由服务端 perm 渲染（DOM 按数字语义顺序插入，读数只看所指槽盘面数字）。
 * - 纯鼠标拖针：SVG pointer 拖针 + setPointerCapture + rAF 节流；删滑杆键盘（无 range/键盘移动针）。
 * - 一周 1560 微槽（字面值，130/数字）；严格档语义命中+中心偏差≤30 微槽（约±6.9°），默认档仅语义命中（判定由服务端重算，前端不做判定）。
 * - 行为采样 (t,x,y) 随 solution 上传，采集侧不下结论（仅透出采样数，判定由服务端重算）。
 */

export const TOTAL_SLOTS = 1560;
export const SLOTS_PER_NUM = 130;
export const STRICT_DEV = 30;

export interface GeometryClockHandle {
  /** 当前微槽 0–1559 + 行为采样（供父调 verify）。 */
  getSolution: () => { microSlot: number; behaviorSamples: BehaviorSample[] };
  /** 采样数（父做空采样阻断用）。 */
  getSampleCount: () => number;
}

interface GeometryClockProps {
  targetHour: number;
  perm: number[];
  strength?: 'low' | 'normal' | 'strict';
  disabled?: boolean;
  dict?: Record<string, string>;
  /** 无操作超时秒：默认 60s，严格档 15s（演示批准增量；父可覆盖为管理 timeoutSec，默认按此）。 */
  idleTimeoutSec?: number;
  onTimeout?: () => void;
  onFirstInteract?: () => void;
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function normMicro(m: number): number {
  return ((Math.round(m) % TOTAL_SLOTS) + TOTAL_SLOTS) % TOTAL_SLOTS;
}

export const GeometryClock = React.forwardRef<GeometryClockHandle, GeometryClockProps>(function GeometryClock(
  { targetHour, perm, strength = 'low', disabled = false, dict = {}, idleTimeoutSec, onTimeout, onFirstInteract },
  ref,
) {
  const timeoutMax = idleTimeoutSec ?? (strength === 'strict' ? 15 : 60);
  const [micro, setMicro] = React.useState<number>(() => {
    // 初始指针落在语义未命中处由父保证；此处仅给确定初值（0），父应在 issue 后按需重置
    return 0;
  });
  const [idleLeft, setIdleLeft] = React.useState(timeoutMax);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const dragRef = React.useRef(false);
  const strokeRef = React.useRef(0);
  const samplesRef = React.useRef<(BehaviorSample & { s: number })[]>([]);
  const pendingRef = React.useRef<{ t: number; x: number; y: number; ang: number } | null>(null);
  const rafRef = React.useRef(0);
  const timerRef = React.useRef<number | null>(null);
  const interactedRef = React.useRef(false);
  const microRef = React.useRef(micro);
  microRef.current = micro;

  const geo = dict;
  const t = (k: string, fb: string): string => geo[k] || fb;

  React.useImperativeHandle(ref, () => ({
    getSolution: () => ({
      microSlot: normMicro(microRef.current),
      behaviorSamples: samplesRef.current.map((s) => ({ t: s.t, x: s.x, y: s.y })),
    }),
    getSampleCount: () => samplesRef.current.length,
  }));

  // 超时倒计时
  React.useEffect(() => {
    setIdleLeft(timeoutMax);
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setIdleLeft((v) => {
        if (v <= 1) {
          if (timerRef.current !== null) window.clearInterval(timerRef.current);
          onTimeout?.();
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutMax]);

  const resetIdle = React.useCallback(() => {
    setIdleLeft(timeoutMax);
  }, [timeoutMax]);

  const now = React.useCallback(() => {
    return window.performance && window.performance.now ? window.performance.now() : Date.now();
  }, []);

  const microToNumSlot = React.useCallback((m: number): number => {
    const mm = normMicro(m);
    return Math.round(mm / SLOTS_PER_NUM) % 12;
  }, []);

  const readingFace = React.useCallback((): number => {
    const slot = microToNumSlot(micro);
    const idx = ((slot % 12) + 12) % 12;
    return perm[idx] ?? 0;
  }, [micro, microToNumSlot, perm]);

  const targetSlot = React.useMemo(() => perm.indexOf(targetHour), [perm, targetHour]);
  const dev = React.useMemo(() => {
    const c = targetSlot * SLOTS_PER_NUM;
    const m = normMicro(micro);
    let d = Math.abs(m - c) % TOTAL_SLOTS;
    if (d > TOTAL_SLOTS / 2) d = TOTAL_SLOTS - d;
    return d;
  }, [micro, targetSlot]);

  const setMicroNorm = React.useCallback(
    (m: number) => {
      setMicro(normMicro(m));
      resetIdle();
    },
    [resetIdle],
  );

  const flushPending = React.useCallback(() => {
    rafRef.current = 0;
    const p = pendingRef.current;
    pendingRef.current = null;
    if (!p) return;
    samplesRef.current.push({ t: p.t, x: p.x, y: p.y, s: strokeRef.current });
    setMicroNorm(Math.round((p.ang / 360) * TOTAL_SLOTS) % TOTAL_SLOTS);
  }, [setMicroNorm]);

  const evtAngle = React.useCallback((clientX: number, clientY: number): number => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const r = svg.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * 200;
    const y = ((clientY - r.top) / r.height) * 200;
    const dx = x - 100;
    const dy = y - 100;
    return ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  }, []);

  // 拖针：仅鼠标主键拖动（pointerType mouse 主键；触屏 pointer 亦允许拖动以保移动端可用，键盘无操作）
  const onPointerDown = React.useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (disabled) return;
      if (e.pointerType === 'mouse' && e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      dragRef.current = true;
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        // 忽略捕获失败
      }
      strokeRef.current += 1;
      samplesRef.current.push({ t: now(), x: e.clientX, y: e.clientY, s: strokeRef.current });
      if (!interactedRef.current) {
        interactedRef.current = true;
        onFirstInteract?.();
      }
      setMicroNorm(Math.round((evtAngle(e.clientX, e.clientY) / 360) * TOTAL_SLOTS) % TOTAL_SLOTS);
    },
    [disabled, evtAngle, now, onFirstInteract, setMicroNorm],
  );

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!dragRef.current || disabled) return;
      e.preventDefault();
      const ang = evtAngle(e.clientX, e.clientY);
      pendingRef.current = { t: now(), x: e.clientX, y: e.clientY, ang };
      if (!rafRef.current) {
        if (window.requestAnimationFrame) rafRef.current = window.requestAnimationFrame(flushPending);
        else flushPending();
      }
    },
    [disabled, evtAngle, flushPending, now],
  );

  const endDrag = React.useCallback(() => {
    dragRef.current = false;
    pendingRef.current = null;
    if (rafRef.current && window.cancelAnimationFrame) {
      try {
        window.cancelAnimationFrame(rafRef.current);
      } catch {
        // 忽略
      }
      rafRef.current = 0;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (rafRef.current && window.cancelAnimationFrame) {
        try {
          window.cancelAnimationFrame(rafRef.current);
        } catch {
          // 忽略
        }
      }
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, []);

  const ticks = React.useMemo(() => {
    const parts: string[] = [];
    for (let m = 0; m < 60; m++) {
      const a = m * 6;
      const major = m % 5 === 0;
      const r1 = major ? 78 : 83;
      const r2 = 90;
      const p1 = polar(100, 100, r1, a);
      const p2 = polar(100, 100, r2, a);
      parts.push(
        `<line x1="${p1[0].toFixed(1)}" y1="${p1[1].toFixed(1)}" x2="${p2[0].toFixed(1)}" y2="${p2[1].toFixed(1)}" stroke-width="${major ? 2.5 : 1}" opacity="${major ? 1 : 0.55}"/>`,
      );
    }
    return parts.join('');
  }, []);

  const nums = React.useMemo(() => {
    // DOM 按数字语义顺序插入，读数只看所指槽位的盘面数字（与演示一致）
    const order = [...perm].sort((a, b) => a - b);
    return order
      .map((num) => {
        const slot = perm.indexOf(num);
        const p = polar(100, 100, 64, slot * 30);
        return `<text class="clock-num" x="${p[0].toFixed(1)}" y="${p[1].toFixed(1)}" data-slot="${slot}" data-num="${num}">${num}</text>`;
      })
      .join('');
  }, [perm]);

  const rotation = (normMicro(micro) * 360) / TOTAL_SLOTS;

  return (
    <div>
      <div className="dial-row flex flex-wrap items-center gap-4">
        <svg
          ref={svgRef}
          viewBox="0 0 200 200"
          role="img"
          aria-label={`${t('target', 'Target hour')}: ${targetHour}, ${t('current', 'Pointing at')}: ${readingFace()}`}
          aria-busy={disabled}
          className="w-[210px] max-w-[60vw] touch-none select-none"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <circle cx="100" cy="100" r="90" fill="none" stroke="#334155" strokeWidth="2" />
          <circle cx="100" cy="100" r="78" fill="none" stroke="#1e293b" strokeWidth="1" />
          <g stroke="#475569" strokeWidth="2" dangerouslySetInnerHTML={{ __html: ticks }} />
          <g dangerouslySetInnerHTML={{ __html: nums }} />
          <text x="100" y="16" fontSize="10" fill="#94a3b8" textAnchor="middle">
            ▼
          </text>
          <g transform={`rotate(${rotation} 100 100)`}>
            <line x1="100" y1="100" x2="100" y2="58" stroke="#0ea5e9" strokeWidth="7" strokeLinecap="round" />
          </g>
          <circle cx="100" cy="100" r="9" fill="#e2e8f0" stroke="#0ea5e9" strokeWidth="3" />
        </svg>
        <dl className="readout min-w-[200px] flex-1 text-[13px]">
          <dt className="text-xs text-slate-400">{t('target', 'Target hour')}</dt>
          <dd className="mono mb-1 text-[15px]">{targetHour}</dd>
          <dt className="text-xs text-slate-400">{t('current', 'Pointing at')}</dt>
          <dd className="mono mb-1 text-[15px]">
            {(t('faceValue', 'Face number {face} (micro {micro}, off-center {dev})') as string)
              .replace('{face}', String(readingFace()))
              .replace('{micro}', String(normMicro(micro)))
              .replace('{dev}', String(dev))}
          </dd>
          <dt className="text-xs text-slate-400">{t('idleCountdown', 'Idle countdown')}</dt>
          <dd className="mono mb-1 text-[15px]" role="status">
            {idleLeft}s
          </dd>
        </dl>
      </div>
      <p className="hint mt-2 text-xs text-slate-400">{t('dragHint', 'Drag the hand with your mouse (no slider or keyboard operation).')}</p>
      <style>{`.clock-num{font-size:15px;font-weight:700;fill:#e2e8f0;text-anchor:middle;dominant-baseline:central;user-select:none;pointer-events:none}`}</style>
    </div>
  );
});

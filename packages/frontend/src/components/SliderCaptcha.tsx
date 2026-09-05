'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { useTranslation } from './TranslationProvider';

interface SliderCaptchaProps {
  onSuccess: (captchaId: string, solution?: SliderCaptchaSolutionPayload) => void;
  apiUrl?: string;
  /**
   * 解锁直兑模式（F1 新增，后向兼容：默认 false 保持原 /verify 流程，现有 5 处调用不受影响）。
   * 为 true 时拖拽完成后不调 POST /verify，而是把完整解 {dragPath,totalDragTime,finalPosition}
   * 回传给父组件，由父调 POST /unlock（冻结契约：unlock 自含验证，不依赖外部 verify 标记）。
   */
  manual?: boolean;
  /**
   * 联邦注入（ additive，不影响现有 5 处调用：缺省时走内部 GET /captcha 拉题）。
   * FederalCaptchaModal slider 分支传入联邦 issue 的 captchaId/image，直接复用采集器，
   * 不占用 legacy 拉题配额；未传时保持原行为。
   */
  externalCaptchaId?: string;
  externalImage?: string | null;
}

export interface SliderCaptchaDragPoint {
  x: number;
  y: number;
  t: number;
}

export interface SliderCaptchaSolutionPayload {
  dragPath: SliderCaptchaDragPoint[];
  totalDragTime: number;
  finalPosition: number;
}

export function SliderCaptcha({ onSuccess, apiUrl = '/api/v1/auth', manual = false, externalCaptchaId, externalImage }: SliderCaptchaProps) {
  const dict = useTranslation();
  const [captchaId, setCaptchaId] = useState<string | null>(null);
  const [captchaImage, setCaptchaImage] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [sliderValue, setSliderValue] = useState(0);

  const dragPathRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const dragStartTimeRef = useRef<number>(0);
  const isDraggingRef = useRef(false);

  const resetUI = useCallback(() => {
    setSliderValue(0);
  }, []);

  const fetchChallenge = useCallback(async () => {
    try {
      setStatus('idle');
      resetUI();
      dragPathRef.current = [];
      setErrorMsg('');
      // 联邦注入优先：直接采用联邦 issue 的 captchaId/image，不再 GET legacy（省一次颁发配额）
      if (externalCaptchaId) {
        setCaptchaId(externalCaptchaId);
        setCaptchaImage(externalImage ?? null);
        return;
      }
      const res = await fetch(`${apiUrl}/captcha`);
      if (!res.ok) throw new Error('Failed to load captcha');
      const data = await res.json();
      setCaptchaId(data.captchaId);
      setCaptchaImage(data.image || null);
    } catch (err: unknown) {
      console.error('Error in fetchChallenge:', err);
      setStatus('error');
      setErrorMsg(dict.captcha.networkError);
    }
  }, [apiUrl, resetUI, dict.captcha.networkError, externalCaptchaId, externalImage]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void fetchChallenge();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [fetchChallenge]);

  const handlePointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
    if (status === 'success' || status === 'verifying') return;
    isDraggingRef.current = true;
    dragStartTimeRef.current = Date.now();
    dragPathRef.current = [{ x: sliderValue, y: e.clientY, t: dragStartTimeRef.current }];
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLInputElement>) => {
    if (!isDraggingRef.current) return;
    const value = Number(e.currentTarget.value);
    setSliderValue(value);
    dragPathRef.current.push({ x: value, y: e.clientY, t: Date.now() });
  };

  const handlePointerUp = async (e: React.PointerEvent<HTMLInputElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setStatus('verifying');

    const totalDragTime = Date.now() - dragStartTimeRef.current;
    const finalPosition = Number(e.currentTarget.value);
    const dragPath = [...dragPathRef.current];

    // 解锁直兑模式：不调 /verify，直接回传完整解由父调 POST /unlock（单次验证，避免 verify+unlock 双调）。
    if (manual) {
      if (!captchaId) {
        setStatus('error');
        setErrorMsg(dict.captcha.networkError);
        return;
      }
      onSuccess(captchaId, { dragPath, totalDragTime, finalPosition });
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/captcha/verify`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          captchaId,
          dragPath,
          totalDragTime,
          finalPosition
        })
      });

      const data = await res.json();
      if (data.success) {
        setStatus('success');
        onSuccess(captchaId!, { dragPath, totalDragTime, finalPosition });
      } else {
        setStatus('error');
        setErrorMsg(dict.apiErrors?.[data.error as keyof typeof dict.apiErrors] || data.error || dict.captcha.verificationFailed);
        setTimeout(fetchChallenge, 1500);
      }
    } catch (err: unknown) {
      console.error(err);
      setStatus('error');
      setErrorMsg(dict.captcha.serverError);
      setTimeout(fetchChallenge, 1500);
    }
  };

  return (
    <div
      className="relative w-full max-w-[350px] mx-auto rounded-2xl border border-white/10 bg-[#0f172a] p-4 shadow-xl select-none touch-none overflow-hidden"
      aria-busy={status === 'verifying'}
    >
      {/* Status Header */}
      <div className="mb-4 text-xs font-medium text-slate-400 flex justify-between items-center tracking-wider">
        <span>{dict.captcha.securityVerification}</span>
        {status === 'success' && <span className="text-emerald-400 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5"/> {dict.captcha.verified}</span>}
        {status === 'error' && <span role="alert" className="text-rose-400 flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5"/> {errorMsg}</span>}
      </div>

      {/* Captcha Area */}
      <div className={`captcha-image ${captchaImage ? 'has-captcha-image' : ''} relative h-32 w-full rounded-xl transition-opacity duration-300 ${status === 'verifying' ? 'opacity-70' : 'opacity-100'}`}>
        {captchaImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={captchaImage} alt={dict.captcha.securityVerification} className="absolute inset-0 h-full w-full rounded-xl object-cover" />
        )}
        {/* Track Container - centered vertically */}
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 mx-2">
          <input
            type="range"
            min="0"
            max="300"
            value={sliderValue}
            disabled={status === 'success' || status === 'verifying'}
            aria-label={dict.captcha.securityVerification}
            aria-valuetext={`${sliderValue}/300`}
            className={`captcha-slider w-full cursor-grab active:cursor-grabbing ${status === 'success' ? 'captcha-slider-success' : status === 'error' ? 'captcha-slider-error' : ''}`}
            onChange={(e) => {
              const value = Number(e.currentTarget.value);
              setSliderValue(value);
              if (isDraggingRef.current) {
                dragPathRef.current.push({ x: value, y: value % 7, t: Date.now() });
              }
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </div>
      </div>
    </div>
  );
}

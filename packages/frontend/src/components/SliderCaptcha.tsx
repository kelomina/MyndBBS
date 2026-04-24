'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { useTranslation } from './TranslationProvider';

interface SliderCaptchaProps {
  onSuccess: (captchaId: string) => void;
  apiUrl?: string;
}

export function SliderCaptcha({ onSuccess, apiUrl = '/api/v1/auth' }: SliderCaptchaProps) {
  const dict = useTranslation();
  const [captchaId, setCaptchaId] = useState<string | null>(null);
  const [captchaImage, setCaptchaImage] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const dragPathRef = useRef<{ x: number; y: number; time: number }[]>([]);
  const dragStartTimeRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const startLeftRef = useRef<number>(0);
  
  const trackRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  const SLIDER_WIDTH = 48;

  const resetUI = useCallback(() => {
    if (sliderRef.current) {
      sliderRef.current.style.transition = 'left 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      sliderRef.current.style.left = '0px';
      setTimeout(() => {
        if (sliderRef.current) sliderRef.current.style.transition = 'none';
      }, 300);
    }
  }, []);

  const fetchChallenge = useCallback(async () => {
    try {
      setStatus('idle');
      resetUI();
      dragPathRef.current = [];
      setErrorMsg('');
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
  }, [apiUrl, resetUI, dict.captcha.networkError]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void fetchChallenge();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [fetchChallenge]);

      const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (status === 'success' || status === 'verifying') return;
    
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    
    startXRef.current = e.clientX;
    startLeftRef.current = parseFloat(sliderRef.current?.style.left || '0');
    
    if (sliderRef.current) sliderRef.current.style.transition = 'none';
    
    dragStartTimeRef.current = Date.now();
    dragPathRef.current = [{ x: startLeftRef.current, y: e.clientY, time: dragStartTimeRef.current }];
  };

      const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !trackRef.current || !sliderRef.current) return;
    
    const trackRect = trackRef.current.getBoundingClientRect();
    const deltaX = e.clientX - startXRef.current;
    let newLeft = startLeftRef.current + deltaX;
    
    const minX = 0;
    const maxX = trackRect.width - SLIDER_WIDTH;
    newLeft = Math.max(minX, Math.min(maxX, newLeft));

    sliderRef.current.style.left = `${newLeft}px`;
    dragPathRef.current.push({ x: newLeft, y: e.clientY, time: Date.now() });
  };

      const handlePointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    
    e.currentTarget.releasePointerCapture(e.pointerId);
    isDraggingRef.current = false;
    setStatus('verifying');

    const totalDragTime = Date.now() - dragStartTimeRef.current;
    const finalPosition = dragPathRef.current[dragPathRef.current.length - 1]?.x ?? 0;

    try {
      const res = await fetch(`${apiUrl}/captcha/verify`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          captchaId,
          dragPath: dragPathRef.current,
          totalDragTime,
          finalPosition
        })
      });

      const data = await res.json();
      if (data.success) {
        setStatus('success');
        onSuccess(captchaId!);
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
    <div className="relative w-[350px] mx-auto rounded-2xl border border-white/10 bg-[#0f172a] p-4 shadow-xl select-none touch-none overflow-hidden">
      {/* Status Header */}
      <div className="mb-4 text-xs font-medium text-slate-400 flex justify-between items-center tracking-wider">
        <span>{dict.captcha.securityVerification}</span>
        {status === 'success' && <span className="text-emerald-400 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5"/> {dict.captcha.verified}</span>}
        {status === 'error' && <span className="text-rose-400 flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5"/> {errorMsg.toUpperCase()}</span>}
      </div>

      {/* Captcha Area */}
      <div 
        className={`relative h-32 w-full rounded-xl transition-opacity duration-300 ${status === 'verifying' ? 'opacity-70' : 'opacity-100'}`}
        style={{ backgroundImage: captchaImage ? `url(${captchaImage})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        {/* Track Container - centered vertically */}
        <div ref={trackRef} className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1.5 bg-white/10 rounded-full mx-2 backdrop-blur-sm shadow-inner">
          
          {/* Glowing Orb Thumb */}
          <div
            ref={sliderRef}
            className={`absolute top-1/2 -translate-y-1/2 w-[48px] h-[48px] rounded-full flex cursor-grab active:cursor-grabbing items-center justify-center transition-all duration-200
              ${status === 'success' ? 'bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.8)] scale-105' : 
                status === 'error' ? 'bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.8)] animate-shake' : 
                'bg-white shadow-[0_0_15px_rgba(255,255,255,0.6)] hover:shadow-[0_0_25px_rgba(255,255,255,0.9)]'}
            `}
            style={{ left: '0px', touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* Inner detail for the orb */}
            <div className={`w-4 h-4 rounded-full ${status === 'success' ? 'bg-emerald-200' : 'bg-slate-200'} opacity-50 blur-[1px]`}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

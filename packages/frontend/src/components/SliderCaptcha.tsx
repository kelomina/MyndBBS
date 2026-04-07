'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

interface SliderCaptchaProps {
  onSuccess: (captchaId: string) => void;
  apiUrl?: string;
}

export function SliderCaptcha({ onSuccess, apiUrl = 'http://127.0.0.1:3001/api/v1/auth' }: SliderCaptchaProps) {
  const [captchaId, setCaptchaId] = useState<string | null>(null);
  const [targetPosition, setTargetPosition] = useState<number>(0);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Refs for tracking and DOM manipulation (avoiding state updates during drag)
  const dragPathRef = useRef<{ x: number; time: number }[]>([]);
  const dragStartTimeRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  
  const trackRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const resetUI = useCallback(() => {
    if (sliderRef.current) sliderRef.current.style.left = '0px';
    if (progressRef.current) progressRef.current.style.width = '25px'; // 25px is half of slider width
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
      setTargetPosition(data.targetPosition);
    } catch (err: unknown) {
      console.error('Error in fetchChallenge:', err);
      setStatus('error');
      setErrorMsg('Network error. Please try again.');
    }
  }, [apiUrl, resetUI]);

  useEffect(() => {
    fetchChallenge();
  }, [fetchChallenge]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (status === 'success' || status === 'verifying') return;
    
    // Capture pointer events so dragging outside the element still works
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    dragStartTimeRef.current = Date.now();
    dragPathRef.current = [{ x: 0, time: dragStartTimeRef.current }];
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !trackRef.current || !sliderRef.current || !progressRef.current) return;
    
    const trackRect = trackRef.current.getBoundingClientRect();
    const SLIDER_WIDTH = 50;
    
    // Calculate new position
    let newLeft = e.clientX - trackRect.left - (SLIDER_WIDTH / 2);
    const minX = 0;
    const maxX = trackRect.width - SLIDER_WIDTH;
    newLeft = Math.max(minX, Math.min(maxX, newLeft));

    // Direct DOM manipulation to avoid React re-renders during 60fps dragging
    sliderRef.current.style.left = `${newLeft}px`;
    progressRef.current.style.width = `${newLeft + (SLIDER_WIDTH / 2)}px`;

    // Record path for anti-bot validation
    dragPathRef.current.push({ x: newLeft, time: Date.now() });
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
        headers: { 'Content-Type': 'application/json' },
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
        setErrorMsg(data.error || 'Verification failed');
        setTimeout(fetchChallenge, 1500); // Reset after delay
      }
    } catch (err: unknown) {
      console.error(err);
      setStatus('error');
      setErrorMsg('Server error');
      setTimeout(fetchChallenge, 1500);
    }
  };

  return (
    <div className="relative w-full rounded-xl border border-border bg-card p-4 shadow-sm select-none touch-none">
      <div className="mb-2 text-sm font-medium text-foreground flex justify-between">
        <span>Security Verification</span>
        {status === 'success' && <span className="text-green-500 flex items-center gap-1"><ShieldCheck className="w-4 h-4"/> Verified</span>}
        {status === 'error' && <span className="text-red-500 flex items-center gap-1"><ShieldAlert className="w-4 h-4"/> {errorMsg}</span>}
      </div>

      {/* Captcha Area */}
      <div className="relative h-24 w-full overflow-hidden rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700">
        {/* Target Zone */}
        {targetPosition > 0 && (
          <div
            className={`absolute top-0 h-full w-[60px] border-l-2 border-r-2 border-primary/50 bg-primary/20 transition-colors ${status === 'success' ? 'bg-green-500/30 border-green-500' : ''}`}
            style={{ left: `${targetPosition}px` }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">🎯</div>
          </div>
        )}

        {/* Slider Track */}
        <div ref={trackRef} className="absolute bottom-2 left-2 right-2 h-12 rounded-full bg-white/80 dark:bg-slate-900/80 shadow-inner">
          {/* Progress Fill */}
          <div
            ref={progressRef}
            className={`absolute top-0 left-0 h-full rounded-l-full transition-colors ${status === 'success' ? 'bg-green-500/50' : 'bg-primary/50'}`}
            style={{ width: '25px' }} // Initial width covers half the slider
          ></div>

          {/* Slider Button */}
          <div
            ref={sliderRef}
            className={`absolute top-0 h-12 w-[50px] flex cursor-grab items-center justify-center rounded-full shadow-md transition-colors ${status === 'success' ? 'bg-green-500 text-white' : 'bg-primary text-white'}`}
            style={{ left: '0px' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {status === 'success' ? '✓' : '➜'}
          </div>
        </div>
      </div>
    </div>
  );
}

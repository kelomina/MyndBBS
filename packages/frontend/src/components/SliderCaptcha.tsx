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
  const [sliderLeft, setSliderLeft] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Tracking
  const dragPathRef = useRef<{ x: number; time: number }[]>([]);
  const dragStartTimeRef = useRef<number>(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const fetchChallenge = useCallback(async () => {
    try {
      setStatus('idle');
      setSliderLeft(0);
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
  }, [apiUrl]);

  useEffect(() => {
    fetchChallenge();
  }, [fetchChallenge]);

  const handlePointerDown = () => {
    if (status === 'success' || status === 'verifying') return;
    setIsDragging(true);
    dragStartTimeRef.current = Date.now();
    dragPathRef.current = [{ x: sliderLeft, time: dragStartTimeRef.current }];
  };

  const handlePointerMove = useCallback((clientX: number) => {
    if (!isDragging || !trackRef.current) return;
    const trackRect = trackRef.current.getBoundingClientRect();
    const SLIDER_WIDTH = 50;
    let newLeft = clientX - trackRect.left - (SLIDER_WIDTH / 2);
    
    const minX = 0;
    const maxX = trackRect.width - SLIDER_WIDTH;
    newLeft = Math.max(minX, Math.min(maxX, newLeft));
    
    setSliderLeft(newLeft);
    dragPathRef.current.push({ x: newLeft, time: Date.now() });
  }, [isDragging]);

  const handlePointerUp = useCallback(async () => {
    if (!isDragging) return;
    setIsDragging(false);
    setStatus('verifying');

    const totalDragTime = Date.now() - dragStartTimeRef.current;
    
    try {
      const res = await fetch(`${apiUrl}/captcha/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captchaId,
          dragPath: dragPathRef.current,
          totalDragTime,
          finalPosition: sliderLeft
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
  }, [isDragging, apiUrl, captchaId, sliderLeft, onSuccess, fetchChallenge]);

  // Global event listeners for drag
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => handlePointerMove(e.clientX);
    const handleGlobalTouchMove = (e: TouchEvent) => handlePointerMove(e.touches[0].clientX);
    const handleGlobalMouseUp = () => handlePointerUp();
    const handleGlobalTouchEnd = () => handlePointerUp();

    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      window.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('touchend', handleGlobalTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]); // Include dependencies to capture latest state

  return (
    <div className="relative w-full rounded-xl border border-border bg-card p-4 shadow-sm select-none">
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
            className={`absolute top-0 left-0 h-full rounded-l-full transition-all ${status === 'success' ? 'bg-green-500/50' : 'bg-primary/50'}`}
            style={{ width: `${sliderLeft + 25}px` }} // +25 to cover half the slider width
          ></div>
          
          {/* Slider Button */}
          <div 
            className={`absolute top-0 h-12 w-[50px] flex cursor-grab items-center justify-center rounded-full shadow-md transition-transform ${isDragging ? 'scale-95 cursor-grabbing' : 'hover:scale-105'} ${status === 'success' ? 'bg-green-500 text-white' : 'bg-primary text-white'}`}
            style={{ left: `${sliderLeft}px` }}
            onMouseDown={(e) => { e.preventDefault(); handlePointerDown(); }}
            onTouchStart={() => { handlePointerDown(); }}
          >
            {status === 'success' ? '✓' : '➜'}
          </div>
        </div>
      </div>
    </div>
  );
}

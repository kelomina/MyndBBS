'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, Puzzle } from 'lucide-react';

interface SliderCaptchaProps {
  onSuccess: (captchaId: string) => void;
  apiUrl?: string;
}

export function SliderCaptcha({ onSuccess, apiUrl = 'http://127.0.0.1:3001/api/v1/auth' }: SliderCaptchaProps) {
  const [captchaId, setCaptchaId] = useState<string | null>(null);
  const [targetPosition, setTargetPosition] = useState<number>(0);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [challengeCompleted, setChallengeCompleted] = useState(false);
  const [isNearTarget, setIsNearTarget] = useState(false);

  // Refs for tracking and DOM manipulation (avoiding state updates during drag)
  const dragPathRef = useRef<{ x: number; time: number }[]>([]);
  const dragStartTimeRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const startLeftRef = useRef<number>(0);
  
  const trackRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const puzzleRef = useRef<HTMLDivElement>(null);

  const SLIDER_WIDTH = 50;
  const TARGET_WIDTH = 60;

  const resetUI = useCallback(() => {
    if (sliderRef.current) sliderRef.current.style.left = '0px';
    if (progressRef.current) progressRef.current.style.width = `${SLIDER_WIDTH / 2}px`;
    if (puzzleRef.current) puzzleRef.current.style.left = '8px'; // 8px corresponds to track's left-2
    setIsNearTarget(false);
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
      setChallengeCompleted(false);
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
    if (!challengeCompleted) {
      setErrorMsg('Please click to confirm you are human first');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
      return;
    }
    if (status === 'success' || status === 'verifying') return;
    
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    
    startXRef.current = e.clientX;
    startLeftRef.current = parseFloat(sliderRef.current?.style.left || '0');
    
    dragStartTimeRef.current = Date.now();
    dragPathRef.current = [{ x: startLeftRef.current, time: dragStartTimeRef.current }];
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !trackRef.current || !sliderRef.current || !progressRef.current) return;
    
    const trackRect = trackRef.current.getBoundingClientRect();
    
    // Use deltaX to avoid jump on click
    const deltaX = e.clientX - startXRef.current;
    let newLeft = startLeftRef.current + deltaX;
    
    const minX = 0;
    const maxX = trackRect.width - SLIDER_WIDTH;
    newLeft = Math.max(minX, Math.min(maxX, newLeft));

    // Direct DOM manipulation
    sliderRef.current.style.left = `${newLeft}px`;
    progressRef.current.style.width = `${newLeft + (SLIDER_WIDTH / 2)}px`;
    
    if (puzzleRef.current) {
      puzzleRef.current.style.left = `${newLeft + 8}px`; // align visually with slider
    }

    dragPathRef.current.push({ x: newLeft, time: Date.now() });

    const sliderCenterGlobal = newLeft + 8 + (SLIDER_WIDTH / 2);
    const targetCenter = targetPosition + (TARGET_WIDTH / 2);
    const distance = Math.abs(sliderCenterGlobal - targetCenter);
    
    setIsNearTarget(distance < 50);
  };

  const handlePointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    
    e.currentTarget.releasePointerCapture(e.pointerId);
    isDraggingRef.current = false;
    setIsNearTarget(false);
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
        setTimeout(fetchChallenge, 1500);
      }
    } catch (err: unknown) {
      console.error(err);
      setStatus('error');
      setErrorMsg('Server error');
      setTimeout(fetchChallenge, 1500);
    }
  };

  return (
    <div className="relative w-full max-w-[400px] mx-auto rounded-xl border border-border bg-card p-4 shadow-sm select-none touch-none">
      <div className="mb-3 text-sm font-medium text-foreground flex justify-between items-center">
        <span>Security Verification</span>
        {status === 'success' && <span className="text-green-500 flex items-center gap-1"><ShieldCheck className="w-4 h-4"/> Verified</span>}
        {status === 'error' && <span className="text-red-500 flex items-center gap-1"><ShieldAlert className="w-4 h-4"/> {errorMsg}</span>}
      </div>

      {/* Challenge Section */}
      {!challengeCompleted ? (
        <div 
          onClick={() => setChallengeCompleted(true)}
          className="flex items-center justify-center gap-2 w-full p-4 mb-3 border-2 border-dashed border-primary/40 rounded-lg cursor-pointer bg-primary/5 hover:bg-primary/10 transition-colors text-primary"
        >
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">Click to confirm you are human</span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 w-full p-4 mb-3 border border-green-500/30 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
          <ShieldCheck className="w-5 h-5" />
          <span className="font-medium">Human confirmed, please slide</span>
        </div>
      )}

      {/* Captcha Area */}
      <div className={`relative h-32 w-full overflow-hidden rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 border border-border/50 transition-opacity ${!challengeCompleted ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
        
        {/* Target Zone */}
        {targetPosition > 0 && (
          <div
            className={`absolute top-0 h-full w-[60px] border-l-2 border-r-2 border-primary/50 bg-primary/20 transition-all duration-300 ${status === 'success' ? 'bg-green-500/30 border-green-500' : ''} ${isNearTarget && status !== 'success' ? 'border-primary bg-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.3)]' : ''}`}
            style={{ left: `${targetPosition}px` }}
          >
            <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl opacity-70">🎯</div>
          </div>
        )}

        {/* Validation Range Hint (Dashed Box) */}
        {targetPosition > 0 && isNearTarget && status !== 'success' && (
          <div 
            className="absolute top-0 h-full border-x-2 border-dashed border-primary/60 bg-primary/5 transition-opacity duration-200"
            style={{ 
              left: `${targetPosition - 15}px`, 
              width: `${TARGET_WIDTH + 30}px` 
            }}
          />
        )}

        {/* Moving Puzzle Piece */}
        {targetPosition > 0 && (
          <div
            ref={puzzleRef}
            className={`absolute top-[30%] w-[50px] h-[40px] -translate-y-1/2 rounded-md border-2 border-white/80 bg-primary/50 shadow-lg backdrop-blur-sm flex items-center justify-center transition-colors ${status === 'success' ? 'bg-green-500/60 border-green-400' : ''}`}
            style={{ left: '8px' }}
          >
            <Puzzle className="text-white w-5 h-5 opacity-90" />
          </div>
        )}

        {/* Slider Track */}
        <div ref={trackRef} className="absolute bottom-2 left-2 right-2 h-12 rounded-full bg-white/90 dark:bg-slate-900/90 shadow-inner border border-border/50">
          {/* Progress Fill */}
          <div
            ref={progressRef}
            className={`absolute top-0 left-0 h-full rounded-l-full transition-colors ${status === 'success' ? 'bg-green-500/50' : 'bg-primary/50'}`}
            style={{ width: '25px' }}
          ></div>

          {/* Slider Button */}
          <div
            ref={sliderRef}
            className={`absolute top-0 h-12 w-[50px] flex cursor-grab active:cursor-grabbing items-center justify-center rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-colors ${status === 'success' ? 'bg-green-500 text-white' : 'bg-primary text-white hover:bg-primary/90'}`}
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

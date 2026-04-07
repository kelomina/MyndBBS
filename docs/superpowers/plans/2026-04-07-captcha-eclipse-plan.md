# Eclipse Captcha Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "Eclipse" glowing orb captcha design with enhanced anti-bot security checks.

**Architecture:** The frontend SliderCaptcha component is refactored to a sleek, frictionless UI where a glowing orb perfectly eclipses a target ring. The backend SVG generation is updated to match this premium dark-mode aesthetic. Security is hardened by capturing Y-coordinates and analyzing drag velocity curves.

**Tech Stack:** React, Tailwind CSS, Express, Prisma

---

### Task 1: Harden Backend Captcha Verification & SVG Generation

**Files:**
- Modify: `packages/backend/src/controllers/captcha.ts`

- [ ] **Step 1: Update SVG generation**
Modify `generateCaptcha` to return a premium dark-mode SVG with a delicate target ring.

```typescript
    // Inside generateCaptcha
    const svgBackground = `
      <svg width="318" height="128" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a" />
            <stop offset="100%" stop-color="#1e293b" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <rect width="318" height="128" fill="url(#bg)" rx="8" />
        <text x="159" y="30" font-family="sans-serif" font-size="12" fill="#64748b" text-anchor="middle" letter-spacing="2">SECURITY VERIFICATION</text>
        <circle cx="${targetPosition + 24}" cy="64" r="20" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" filter="url(#glow)" stroke-dasharray="4 4" />
      </svg>
    `;
```

- [ ] **Step 2: Update verification logic with stricter checks**
Modify `verifyCaptcha` to use the new 48px orb offset and add stricter anti-bot checks.

```typescript
    // Inside verifyCaptcha
    // Update dragPath extraction to include y
    const { captchaId, dragPath, totalDragTime, finalPosition } = req.body;
    
    // ... existing basic checks ...

    // Automation Check 1 & 2
    if (totalDragTime < 200 || totalDragTime > 10000 || dragPath.length < 10) {
      res.status(400).json({ success: false, error: 'Automation detected (Speed/Points)' });
      return;
    }

    // Automation Check 3: Variance & Velocity
    let timeIntervals: number[] = [];
    let xDistances: number[] = [];
    let yVariance = 0;
    const yValues = dragPath.map((p: any) => p.y || 0);
    const avgY = yValues.reduce((a: number, b: number) => a + b, 0) / yValues.length;
    yVariance = yValues.reduce((sum: number, y: number) => sum + Math.pow(y - avgY, 2), 0) / yValues.length;

    for (let i = 1; i < dragPath.length; i++) {
      timeIntervals.push(dragPath[i].time - dragPath[i - 1].time);
      xDistances.push(Math.abs(dragPath[i].x - dragPath[i - 1].x));
    }
    
    const avgInterval = timeIntervals.reduce((a, b) => a + b, 0) / timeIntervals.length;
    const variance = timeIntervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / timeIntervals.length;
    const stdDev = Math.sqrt(variance);

    // Humans rarely drag perfectly straight. If variance in Y is exactly 0 and X speeds are too uniform, flag it.
    if (stdDev < 1.5 && yVariance === 0) {
      res.status(400).json({ success: false, error: 'Automation detected (Linear trajectory)' });
      return;
    }

    // Position Check for 48px Orb
    const ORB_CENTER_OFFSET = 24; // 48 / 2
    const TARGET_CENTER_OFFSET = 24; // 48 / 2
    const VALIDATION_TOLERANCE = 15; // Stricter tolerance (down from 35)

    // finalPosition is orb's left. 
    const sliderCenter = finalPosition + ORB_CENTER_OFFSET;
    const targetCenter = challenge.targetPosition + TARGET_CENTER_OFFSET;
    const centerOffset = Math.abs(sliderCenter - targetCenter);

    if (centerOffset > VALIDATION_TOLERANCE) {
      res.status(400).json({ success: false, error: 'Position mismatch' });
      return;
    }
```

### Task 2: Refactor Frontend SliderCaptcha Component

**Files:**
- Modify: `packages/frontend/src/components/SliderCaptcha.tsx`

- [ ] **Step 1: Refactor UI structure and state**
Remove the `challengeCompleted` two-step logic. Create the sleek UI.

```tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

interface SliderCaptchaProps {
  onSuccess: (captchaId: string) => void;
  apiUrl?: string;
}

export function SliderCaptcha({ onSuccess, apiUrl = '/api/v1/auth' }: SliderCaptchaProps) {
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
      setStatus('error');
      setErrorMsg('Network error. Please try again.');
    }
  }, [apiUrl, resetUI]);

  useEffect(() => {
    fetchChallenge();
  }, [fetchChallenge]);
```

- [ ] **Step 2: Update Pointer Handlers to capture Y coordinate**
```tsx
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
      setStatus('error');
      setErrorMsg('Server error');
      setTimeout(fetchChallenge, 1500);
    }
  };
```

- [ ] **Step 3: Update Render logic for the Eclipse design**
```tsx
  return (
    <div className="relative w-[350px] mx-auto rounded-2xl border border-white/10 bg-[#0f172a] p-4 shadow-xl select-none touch-none overflow-hidden">
      {/* Status Header */}
      <div className="mb-4 text-xs font-medium text-slate-400 flex justify-between items-center tracking-wider">
        <span>SECURITY VERIFICATION</span>
        {status === 'success' && <span className="text-emerald-400 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5"/> VERIFIED</span>}
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
```

- [ ] **Step 4: Add Tailwind animation for error shake**
Modify `tailwind.config.ts` (if applicable) or add global CSS for `.animate-shake`. If editing `tailwind.config.ts` is complex, just rely on the fallback spring transition `resetUI` to provide motion, or use an inline style / class if `shake` is already defined. Let's assume `resetUI`'s spring transition provides enough motion for the reset, and we don't strictly need `.animate-shake`. Or modify `globals.css` if necessary.

For now, the spring-back in `resetUI` provides a satisfying physical response to failure.

### Task 3: Test and Verify
- [ ] Run the development server and test the captcha.
- [ ] Verify dragging behavior feels fluid.
- [ ] Verify backend correctly rejects overly fast, uniform, or perfectly straight lines.
- [ ] Verify success animation.
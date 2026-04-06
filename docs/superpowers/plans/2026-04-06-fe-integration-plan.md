# Frontend Auth & Captcha Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the frontend Login and Register pages with the new backend Auth and Captcha APIs, translating the raw HTML/JS slider into a reusable React component.

**Architecture:** 
1. Create a `SliderCaptcha` React component that mimics the behavior of the provided HTML, but fetches the `targetPosition` from `GET /api/auth/captcha` and posts the trajectory to `POST /api/auth/captcha/verify`.
2. Convert the `RegisterPage` to a Client Component to handle form state and embed the `SliderCaptcha`. Upon successful verification, it receives a `captchaId` which is then sent along with the registration data to `POST /api/auth/register`.
3. Convert the `LoginPage` to a Client Component to handle form state, submitting to `POST /api/auth/login`, and storing the resulting JWT.

**Tech Stack:** Next.js (React 19), Tailwind CSS, Fetch API.

---

### Task 1: Create SliderCaptcha React Component

**Files:**
- Create: `packages/frontend/src/components/SliderCaptcha.tsx`

- [ ] **Step 1: Create SliderCaptcha Component**
  Create `packages/frontend/src/components/SliderCaptcha.tsx`. This translates the logic from `增强反自动化滑块验证系统.html` into React state.
  ```tsx
  'use client';

  import React, { useState, useEffect, useRef, useCallback } from 'react';
  import { ShieldCheck, ShieldAlert } from 'lucide-react';

  interface SliderCaptchaProps {
    onSuccess: (captchaId: string) => void;
    apiUrl?: string;
  }

  export function SliderCaptcha({ onSuccess, apiUrl = 'http://localhost:3001/api/auth' }: SliderCaptchaProps) {
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
      } catch (err) {
        setStatus('error');
        setErrorMsg('Network error. Please try again.');
      }
    }, [apiUrl]);

    useEffect(() => {
      fetchChallenge();
    }, [fetchChallenge]);

    const handlePointerDown = (clientX: number) => {
      if (status === 'success' || status === 'verifying') return;
      setIsDragging(true);
      dragStartTimeRef.current = Date.now();
      dragPathRef.current = [{ x: sliderLeft, time: dragStartTimeRef.current }];
    };

    const handlePointerMove = (clientX: number) => {
      if (!isDragging || !trackRef.current) return;
      const trackRect = trackRef.current.getBoundingClientRect();
      const SLIDER_WIDTH = 50;
      let newLeft = clientX - trackRect.left - (SLIDER_WIDTH / 2);
      
      const minX = 0;
      const maxX = trackRect.width - SLIDER_WIDTH;
      newLeft = Math.max(minX, Math.min(maxX, newLeft));
      
      setSliderLeft(newLeft);
      dragPathRef.current.push({ x: newLeft, time: Date.now() });
    };

    const handlePointerUp = async () => {
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
      } catch (err) {
        setStatus('error');
        setErrorMsg('Server error');
        setTimeout(fetchChallenge, 1500);
      }
    };

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
    }, [isDragging, sliderLeft]); // Include dependencies to capture latest state

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
              onMouseDown={(e) => { e.preventDefault(); handlePointerDown(e.clientX); }}
              onTouchStart={(e) => { handlePointerDown(e.touches[0].clientX); }}
            >
              {status === 'success' ? '✓' : '➜'}
            </div>
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add packages/frontend/src/components/SliderCaptcha.tsx
  git commit -m "feat(frontend): create React SliderCaptcha component integrated with backend API"
  ```

### Task 2: Integrate Captcha into Register Page

**Files:**
- Modify: `packages/frontend/src/app/(auth)/register/page.tsx`

- [ ] **Step 1: Convert to Client Component and Integrate**
  Since `page.tsx` used `headers()` which is server-only, we must separate the server layout from the client form.
  Rewrite `packages/frontend/src/app/(auth)/register/page.tsx`:
  ```tsx
  import { headers } from 'next/headers';
  import { getDictionary } from '../../../i18n/get-dictionary';
  import { Locale, defaultLocale } from '../../../i18n/config';
  import { RegisterClient } from './RegisterClient';

  export default async function RegisterPage() {
    const headersList = await headers();
    const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
    const dict = await getDictionary(locale);

    return <RegisterClient dict={dict} />;
  }
  ```

- [ ] **Step 2: Create RegisterClient Component**
  Create `packages/frontend/src/app/(auth)/register/RegisterClient.tsx`:
  ```tsx
  'use client';

  import React, { useState } from 'react';
  import Link from 'next/link';
  import { useRouter } from 'next/navigation';
  import { SliderCaptcha } from '../../../components/SliderCaptcha';

  export function RegisterClient({ dict }: { dict: any }) {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [captchaId, setCaptchaId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (!captchaId) {
        setError('Please complete the security verification first.');
        return;
      }

      setLoading(true);
      try {
        const res = await fetch('http://localhost:3001/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, username, password, captchaId })
        });
        
        const data = await res.json();
        
        if (res.ok) {
          // Store token and redirect
          localStorage.setItem('token', data.token);
          // Setting a cookie might be needed for SSR auth later
          document.cookie = `auth_token=${data.token}; path=/; max-age=604800`; 
          router.push('/');
          router.refresh();
        } else {
          setError(data.error || 'Registration failed');
          setCaptchaId(null); // Force re-verification on fail
        }
      } catch (err) {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="rounded-2xl bg-card px-8 py-10 shadow-sm border border-border/50">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">{dict.auth.joinMyndbbs}</h2>
          <p className="mt-2 text-sm text-muted">{dict.auth.createAccountToJoin}</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground">{dict.auth.emailAddress}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 bg-background focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground">{dict.auth.username}</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 bg-background focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground">{dict.auth.password}</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 bg-background focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
            />
            <p className="mt-1 text-xs text-muted">{dict.auth.passwordHint}</p>
          </div>

          {/* Slider Captcha Integration */}
          {!captchaId ? (
            <SliderCaptcha onSuccess={(id) => setCaptchaId(id)} />
          ) : (
            <div className="rounded-lg border border-green-500/50 bg-green-50/50 dark:bg-green-900/20 p-3 text-center text-sm font-medium text-green-600 dark:text-green-400">
              ✓ Security Verification Passed
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading || !captchaId}
              className="flex w-full justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : dict.auth.createAccount}
            </button>
          </div>
        </form>

        <p className="mt-8 text-center text-sm text-muted">
          {dict.auth.alreadyHaveAccount}{' '}
          <Link href="/login" className="font-medium text-primary hover:text-primary/80">
            {dict.auth.signIn}
          </Link>
        </p>
      </div>
    );
  }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add packages/frontend/src/app/\(auth\)/register
  git commit -m "feat(frontend): integrate slider captcha and api into registration flow"
  ```

### Task 3: Integrate Login API

**Files:**
- Modify: `packages/frontend/src/app/(auth)/login/page.tsx`
- Create: `packages/frontend/src/app/(auth)/login/LoginClient.tsx`

- [ ] **Step 1: Convert to Client Component Pattern**
  Modify `packages/frontend/src/app/(auth)/login/page.tsx`:
  ```tsx
  import { headers } from 'next/headers';
  import { getDictionary } from '../../../i18n/get-dictionary';
  import { Locale, defaultLocale } from '../../../i18n/config';
  import { LoginClient } from './LoginClient';

  export default async function LoginPage() {
    const headersList = await headers();
    const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
    const dict = await getDictionary(locale);

    return <LoginClient dict={dict} />;
  }
  ```

- [ ] **Step 2: Create LoginClient Component**
  Create `packages/frontend/src/app/(auth)/login/LoginClient.tsx`:
  ```tsx
  'use client';

  import React, { useState } from 'react';
  import Link from 'next/link';
  import { useRouter } from 'next/navigation';
  import { Fingerprint } from 'lucide-react';

  export function LoginClient({ dict }: { dict: any }) {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);

      try {
        const res = await fetch('http://localhost:3001/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        
        if (res.ok) {
          localStorage.setItem('token', data.token);
          document.cookie = `auth_token=${data.token}; path=/; max-age=604800`;
          router.push('/');
          router.refresh();
        } else {
          setError(data.error || 'Login failed');
        }
      } catch (err) {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="rounded-2xl bg-card px-8 py-10 shadow-sm border border-border/50">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">{dict.auth.welcomeBack}</h2>
          <p className="mt-2 text-sm text-muted">{dict.auth.signInToAccount}</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground">{dict.auth.emailAddress}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-border px-3 py-2 bg-background focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground">{dict.auth.password}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-border px-3 py-2 bg-background focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input type="checkbox" className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
              <label className="ml-2 block text-sm text-muted">{dict.auth.rememberMe}</label>
            </div>
            <div className="text-sm">
              <a href="#" className="font-medium text-primary hover:text-primary/80">{dict.auth.forgotPassword}</a>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full justify-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-sm hover:bg-foreground/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : dict.auth.signIn}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-sm"><span className="bg-card px-2 text-muted">{dict.auth.orContinueWith}</span></div>
          </div>
          <div className="mt-6">
            <button className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-background transition-colors">
              <Fingerprint className="h-5 w-5 text-primary" />
              {dict.auth.signInWithPasskey}
            </button>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-muted">
          {dict.auth.dontHaveAccount}{' '}
          <Link href="/register" className="font-medium text-primary hover:text-primary/80">
            {dict.auth.signUpNow}
          </Link>
        </p>
      </div>
    );
  }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add packages/frontend/src/app/\(auth\)/login
  git commit -m "feat(frontend): integrate login API and auth state handling"
  ```
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SliderCaptcha } from '../../../components/SliderCaptcha';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    if (password.length < 8 || password.length > 128) {
      setError('Password must be between 8 and 128 characters');
      return;
    }
    
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}/.test(password)) {
      setError('Password must contain uppercase, lowercase, number, and special character');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:3001/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, username, password, captchaId })
      });
      
      const data = await res.json();
      
      if (res.ok) {
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

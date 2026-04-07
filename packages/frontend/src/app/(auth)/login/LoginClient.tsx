'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fingerprint } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      const res = await fetch('http://127.0.0.1:3001/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      
      if (res.ok) {
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

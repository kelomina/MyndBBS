import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export default function RegisterPage() {
  return (
    <div className="rounded-2xl bg-card px-8 py-10 shadow-sm border border-border/50">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Join MyndBBS</h2>
        <p className="mt-2 text-sm text-muted">
          Create an account to join the conversation
        </p>
      </div>

      <form className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            Email address
          </label>
          <div className="mt-1">
            <input
              id="email"
              name="email"
              type="email"
              required
              className="block w-full rounded-lg border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm bg-background"
            />
          </div>
        </div>

        <div>
          <label htmlFor="username" className="block text-sm font-medium text-foreground">
            Username
          </label>
          <div className="mt-1">
            <input
              id="username"
              name="username"
              type="text"
              required
              className="block w-full rounded-lg border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm bg-background"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground">
            Password
          </label>
          <div className="mt-1">
            <input
              id="password"
              name="password"
              type="password"
              required
              className="block w-full rounded-lg border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm bg-background"
            />
          </div>
          <p className="mt-1 text-xs text-muted">
            Must be at least 8 characters, include uppercase, lowercase, number & special char.
          </p>
        </div>

        {/* Mock Captcha Area */}
        <div className="rounded-lg border border-dashed border-border bg-background p-4 flex items-center justify-center gap-2 text-sm text-muted">
          <ShieldCheck className="h-5 w-5 text-green-500" />
          <span>Captcha Verification Area</span>
        </div>

        <div>
          <button
            type="submit"
            className="flex w-full justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
          >
            Create Account
          </button>
        </div>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:text-primary/80">
          Sign in
        </Link>
      </p>
    </div>
  );
}

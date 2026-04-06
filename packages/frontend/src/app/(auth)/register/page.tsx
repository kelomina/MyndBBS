import Link from 'next/link';
import { headers } from 'next/headers';
import { ShieldCheck } from 'lucide-react';
import { getDictionary } from '../../../i18n/get-dictionary';
import { Locale, defaultLocale } from '../../../i18n/config';

export default async function RegisterPage() {
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  return (
    <div className="rounded-2xl bg-card px-8 py-10 shadow-sm border border-border/50">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{dict.auth.joinMyndbbs}</h2>
        <p className="mt-2 text-sm text-muted">
          {dict.auth.createAccountToJoin}
        </p>
      </div>

      <form className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            {dict.auth.emailAddress}
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
            {dict.auth.username}
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
            {dict.auth.password}
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
            {dict.auth.passwordHint}
          </p>
        </div>

        {/* Mock Captcha Area */}
        <div className="rounded-lg border border-dashed border-border bg-background p-4 flex items-center justify-center gap-2 text-sm text-muted">
          <ShieldCheck className="h-5 w-5 text-green-500" />
          <span>{dict.auth.captchaArea}</span>
        </div>

        <div>
          <button
            type="submit"
            className="flex w-full justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
          >
            {dict.auth.createAccount}
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

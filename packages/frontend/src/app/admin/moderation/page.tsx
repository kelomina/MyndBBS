import { getDictionary } from '../../../i18n/get-dictionary';
import { defaultLocale, Locale } from '../../../i18n/config';
import { headers, cookies } from 'next/headers';
import ModerationClient from './ModerationClient';

export default async function ModerationPage() {
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ');

  const apiOrigin = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
  let canManageWords = false;
  try {
    const res = await fetch(`${apiOrigin}/api/v1/user/profile`, {
      headers: { Cookie: allCookies },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json() as { user?: { role?: string } };
      const role = data.user?.role;
      canManageWords = role === 'SUPER_ADMIN' || role === 'ADMIN';
    }
  } catch {
    // Default to false if fetch fails
  }

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-bold tracking-tight text-foreground mb-6">
        {dict.admin?.moderation || "Moderation"}
      </h1>
      <ModerationClient dict={dict} canManageWords={canManageWords} />
    </div>
  );
}

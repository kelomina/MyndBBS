import { getDictionary } from '../../../i18n/get-dictionary';
import { defaultLocale, Locale } from '../../../i18n/config';
import { headers } from 'next/headers';
import ModerationClient from './ModerationClient';

export default async function ModerationPage() {
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-bold tracking-tight text-foreground mb-6">
        {dict.admin?.moderation || "Moderation"}
      </h1>
      <ModerationClient dict={dict} />
    </div>
  );
}

import { headers } from 'next/headers';
import { Locale, defaultLocale } from '../../i18n/config';
import { getDictionary } from '../../i18n/get-dictionary';
import { WikiListClient } from './WikiListClient';

export default async function WikisPage() {
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <WikiListClient dict={dict} />
      </div>
    </div>
  );
}

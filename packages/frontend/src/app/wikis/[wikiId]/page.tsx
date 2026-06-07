import { headers } from 'next/headers';
import { Locale, defaultLocale } from '../../../i18n/config';
import { getDictionary } from '../../../i18n/get-dictionary';
import { WikiDetailClient } from './WikiDetailClient';

export default async function WikiDetailPage({ params }: { params: Promise<{ wikiId: string }> }) {
  const { wikiId } = await params;
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <WikiDetailClient dict={dict} wikiId={wikiId} />
    </div>
  );
}

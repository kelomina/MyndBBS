import { headers } from 'next/headers';
import { Locale, defaultLocale } from '../../../../../i18n/config';
import { getDictionary } from '../../../../../i18n/get-dictionary';
import { WikiPageDetailClient } from './WikiPageDetailClient';

export default async function WikiPageDetailPage({
  params,
}: {
  params: Promise<{ wikiId: string; pageId: string }>;
}) {
  const { wikiId, pageId } = await params;
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <WikiPageDetailClient dict={dict} wikiId={wikiId} pageId={pageId} />
    </div>
  );
}

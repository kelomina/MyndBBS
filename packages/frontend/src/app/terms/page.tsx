import { headers } from "next/headers";
import { Locale, defaultLocale } from "../../i18n/config";
import { TermsEn } from "./TermsEn";
import { TermsZh } from "./TermsZh";

export default async function TermsPage() {
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 prose dark:prose-invert prose-primary">
      {locale === 'zh' ? <TermsZh /> : <TermsEn />}
    </div>
  );
}

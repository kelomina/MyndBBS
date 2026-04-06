'use client';

import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import { Locale } from '../i18n/config';

export function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const router = useRouter();

  const toggleLanguage = () => {
    const nextLocale = currentLocale === 'en' ? 'zh' : 'en';
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000`;
    router.refresh();
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:bg-background hover:text-foreground"
      title={currentLocale === 'en' ? 'Switch to Chinese' : '切换至英文'}
    >
      <Globe className="h-5 w-5" />
      <span className="sr-only">Toggle Language</span>
    </button>
  );
}
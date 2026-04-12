'use client';

import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import { Locale } from '../i18n/config';
import { useTranslation } from './TranslationProvider';

/**
 * Callers: []
 * Callees: [useTranslation, useRouter, refresh]
 * Description: Handles the language switcher logic for the application.
 * Keywords: languageswitcher, language, switcher, auto-annotated
 */
export function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const dict = useTranslation();
  const router = useRouter();

  /**
     * Callers: []
     * Callees: [refresh]
     * Description: Handles the toggle language logic for the application.
     * Keywords: togglelanguage, toggle, language, auto-annotated
     */
    const toggleLanguage = () => {
    const nextLocale = currentLocale === 'en' ? 'zh' : 'en';
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000`;
    router.refresh();
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:bg-background hover:text-foreground"
      title={dict.common.toggleLanguage}
    >
      <Globe className="h-5 w-5" />
      <span className="sr-only">{dict.common.toggleLanguage}</span>
    </button>
  );
}
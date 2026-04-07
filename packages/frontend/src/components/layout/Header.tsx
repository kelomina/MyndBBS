import Link from 'next/link';
import { Search, PenSquare } from 'lucide-react';
import { getDictionary } from '../../i18n/get-dictionary';
import { Locale } from '../../i18n/config';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { ThemeToggle } from '../ThemeToggle';
import { UserNav } from './UserNav';

export async function Header({ locale }: { locale: Locale }) {
  const dict = await getDictionary(locale);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <Link href="/" className="text-xl font-bold tracking-tight text-primary">
            MyndBBS
          </Link>
        </div>
        
        <div className="flex flex-1 items-center justify-center px-8">
          <div className="relative w-full max-w-md hidden sm:block">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-muted" />
            </div>
            <input
              type="search"
              className="block w-full rounded-full border border-border bg-background py-2 pl-10 pr-3 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={dict.common.searchPlaceholder}
            />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <ThemeToggle />
          <LanguageSwitcher currentLocale={locale} />
          <Link 
            href="/compose" 
            className="hidden sm:flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <PenSquare className="mr-2 h-4 w-4" />
            {dict.common.newPost}
          </Link>
          <UserNav title={dict.common.account} />
        </div>
      </div>
    </header>
  );
}
import Link from 'next/link'
import { getPublicDictionary } from '../../i18n/public-dictionary'
import { Locale } from '../../i18n/config'
import { LanguageSwitcher } from '../LanguageSwitcher'
import { ThemeToggle } from '../ThemeToggle'
import { UserNav } from './UserNav'

import { SearchInput } from '../SearchInput'
import { serverFetch } from '../../lib/bff/serverApi'

interface PublicSiteSettings {
  siteName: string | null
  announcement: string | null
}

async function getSiteSettings(): Promise<PublicSiteSettings> {
  try {
    const res = await serverFetch('/api/public/site-settings')
    if (!res.ok) return { siteName: null, announcement: null }
    return (await res.json()) as PublicSiteSettings
  } catch {
    return { siteName: null, announcement: null }
  }
}

export async function Header({ locale }: { locale: Locale }) {
  const [dict, settings] = await Promise.all([getPublicDictionary(locale), getSiteSettings()])
  const brand = settings.siteName || 'MyndBBS'
  const announcement = settings.announcement

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <Link href="/" className="text-xl font-bold tracking-tight text-primary">
            {brand}
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-8">
          <SearchInput placeholder={dict.common.searchPlaceholder} />
        </div>

        <div className="flex items-center space-x-3">
          <ThemeToggle />
          <LanguageSwitcher currentLocale={locale} />
          <UserNav
            title={dict.common.account}
            newPostText={dict.common.newPost}
            messagesText={dict.messages.title}
          />
        </div>
      </div>

      {announcement && (
        <div
          role="status"
          className="border-t border-border bg-primary/10 px-4 py-2 text-center text-sm text-foreground"
        >
          📢 {announcement}
        </div>
      )}
    </header>
  )
}

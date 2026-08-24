import type { Metadata } from 'next'
import { headers } from 'next/headers'
import 'katex/dist/katex.min.css'
import './globals.css'
import { Header } from '../components/layout/Header'
import { Locale, defaultLocale } from '../i18n/config'
import { getPublicDictionary } from '../i18n/public-dictionary'
import { ThemeProvider } from '../components/ThemeProvider'
import { TranslationProvider } from '../components/TranslationProvider'
import { PasskeyBanner } from '../components/PasskeyBanner'
import { CookieConsentModal } from '../components/CookieConsentModal'
import { ToastProvider } from '../components/ui/Toast'
import { SWRegister } from '../components/SWRegister'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kolobbs.kolostudio.fun'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'MyndBBS - Modern Community',
    template: '%s | MyndBBS',
  },
  description: 'A clean, fast, and secure community platform.',
  openGraph: {
    type: 'website',
    siteName: 'MyndBBS',
    url: SITE_URL,
  },
}

export const viewport = {
  themeColor: '#4f46e5',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const headersList = await headers()
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale
  const nonce = headersList.get('x-nonce')
  const dict = await getPublicDictionary(locale)

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-background transition-colors duration-300">
        <ThemeProvider nonce={nonce}>
          <TranslationProvider dict={dict}>
<ToastProvider>
<SWRegister />
<PasskeyBanner />
              <Header locale={locale} />
              <CookieConsentModal />
              <div className="flex-1">{children}</div>
            </ToastProvider>
          </TranslationProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

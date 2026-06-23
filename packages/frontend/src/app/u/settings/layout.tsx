import React from 'react'
import { headers } from 'next/headers'
import { defaultLocale, type Locale } from '../../../i18n/config'
import { getDictionary } from '../../../i18n/get-dictionary'
import { TranslationProvider } from '../../../components/TranslationProvider'

export default async function UserSettingsLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale
  const dict = await getDictionary(locale)

  return <TranslationProvider dict={dict}>{children}</TranslationProvider>
}

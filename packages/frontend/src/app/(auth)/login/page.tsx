import { headers } from 'next/headers';
import { getDictionary } from '../../../i18n/get-dictionary';
import { Locale, defaultLocale } from '../../../i18n/config';
import { LoginClient } from './LoginClient';

export default async function LoginPage() {
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  return <LoginClient dict={dict} />;
}

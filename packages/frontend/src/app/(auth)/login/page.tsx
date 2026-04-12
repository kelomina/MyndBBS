import { headers } from 'next/headers';
import { getDictionary } from '../../../i18n/get-dictionary';
import { Locale, defaultLocale } from '../../../i18n/config';
import { LoginClient } from './LoginClient';

/**
 * Callers: []
 * Callees: [headers, get, getDictionary]
 * Description: Handles the login page logic for the application.
 * Keywords: loginpage, login, page, auto-annotated
 */
export default async function LoginPage() {
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  return <LoginClient dict={dict} />;
}

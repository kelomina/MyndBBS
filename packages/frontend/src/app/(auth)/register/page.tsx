import { headers } from 'next/headers';
import { getDictionary } from '../../../i18n/get-dictionary';
import { Locale, defaultLocale } from '../../../i18n/config';
import { RegisterClient } from './RegisterClient';

/**
 * Callers: []
 * Callees: [headers, get, getDictionary]
 * Description: Handles the register page logic for the application.
 * Keywords: registerpage, register, page, auto-annotated
 */
export default async function RegisterPage() {
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  return <RegisterClient dict={dict} />;
}

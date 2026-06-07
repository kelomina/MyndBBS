import { headers } from 'next/headers';
import { getDictionary } from '../../../i18n/get-dictionary';
import { Locale, defaultLocale } from '../../../i18n/config';
import { RegisterClient } from './RegisterClient';

export default async function RegisterPage() {
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  return <RegisterClient dict={dict} />;
}

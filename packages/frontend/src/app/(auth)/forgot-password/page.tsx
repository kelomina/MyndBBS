import { headers } from 'next/headers';

import { Locale, defaultLocale } from '../../../i18n/config';
import { getDictionary } from '../../../i18n/get-dictionary';
import { ForgotPasswordClient } from './ForgotPasswordClient';

export default async function ForgotPasswordPage() {
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  return <ForgotPasswordClient dict={dict} />;
}

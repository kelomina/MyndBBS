import { headers } from 'next/headers';

import { Locale, defaultLocale } from '../../../i18n/config';
import { getDictionary } from '../../../i18n/get-dictionary';
import { ResetPasswordClient } from './ResetPasswordClient';

export default async function ResetPasswordPage() {
  const headersList = await headers();
  const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
  const dict = await getDictionary(locale);

  return <ResetPasswordClient dict={dict} />;
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { defaultLocale, locales } from './i18n/config';

function getLocale(request: NextRequest): string {
  // 1. Check cookie
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (cookieLocale && locales.includes(cookieLocale as any)) {
    return cookieLocale;
  }

  // 2. Check Accept-Language header
  const acceptLang = request.headers.get('Accept-Language');
  if (acceptLang) {
    if (acceptLang.includes('zh')) return 'zh';
  }

  return defaultLocale;
}

export function middleware(request: NextRequest) {
  const locale = getLocale(request);
  
  const response = NextResponse.next();
  
  // Set cookie if not present or differs from detected
  if (request.cookies.get('NEXT_LOCALE')?.value !== locale) {
    response.cookies.set('NEXT_LOCALE', locale, { path: '/' });
  }
  
  // We pass the locale to headers so Server Components can read it without needing to parse cookies manually everywhere
  response.headers.set('x-locale', locale);
  response.headers.set('x-pathname', request.nextUrl.pathname);

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { defaultLocale, locales } from './i18n/config';

function getLocale(request: NextRequest): string {
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (cookieLocale && locales.includes(cookieLocale as any)) {
    return cookieLocale;
  }

  const acceptLang = request.headers.get('Accept-Language');
  if (acceptLang) {
    if (acceptLang.includes('zh')) return 'zh';
  }

  return defaultLocale;
}

export function proxy(request: NextRequest) {
  const locale = getLocale(request);
  const pathname = request.nextUrl.pathname;

  // Set response and locale header
  const response = NextResponse.next();
  if (request.cookies.get('NEXT_LOCALE')?.value !== locale) {
    response.cookies.set('NEXT_LOCALE', locale, { path: '/' });
  }
  response.headers.set('x-locale', locale);

  // 403 Protection Logic
  const isPublicPath = pathname === '/' || pathname === '/login' || pathname === '/register' || pathname === '/403' || pathname === '/popular' || pathname === '/recent' || pathname === '/compose' || pathname === '/friends' || pathname.startsWith('/p/') || pathname.startsWith('/c/') || pathname.startsWith('/u/') || pathname.startsWith('/messages') || pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/uploads');

  // Allow internal navigation via Referer check
  const referer = request.headers.get('referer');
  const isInternalNavigation = referer && referer.startsWith(request.nextUrl.origin);
  const isNextClientNavigation = request.headers.has('rsc') || request.headers.has('next-router-prefetch');

  if (!isPublicPath && !(isInternalNavigation || isNextClientNavigation)) {
    const token = request.cookies.get('accessToken')?.value;
    let isSuperAdmin = false;

    if (token) {
      try {
        const payload = token.split('.')[1];
        let b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        const decoded = atob(b64);
        const parsed = JSON.parse(decoded);
        if (parsed.role === 'SUPER_ADMIN') {
          isSuperAdmin = true;
        }
      } catch (e) {
        // ignore
      }
    }

    if (!isSuperAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = '/403';
      
      // Preserve locale cookie on redirect
      const redirectResponse = NextResponse.redirect(url);
      if (request.cookies.get('NEXT_LOCALE')?.value !== locale) {
        redirectResponse.cookies.set('NEXT_LOCALE', locale, { path: '/' });
      }
      return redirectResponse;
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

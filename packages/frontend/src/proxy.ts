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


let cachedWhitelist: any[] | null = null;
let lastFetchTime = 0;

async function getWhitelist() {
  const now = Date.now();
  if (cachedWhitelist && now - lastFetchTime < 30000) {
    return cachedWhitelist;
  }
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
    const res = await fetch(`${apiUrl}/api/admin/routing-whitelist`, {
      next: { revalidate: 30 }
    });
    if (res.ok) {
      cachedWhitelist = await res.json();
      lastFetchTime = now;
      return cachedWhitelist;
    }
  } catch (e) {
    console.error('Failed to fetch routing whitelist in proxy:', e);
  }
  return cachedWhitelist || [];
}

export async function proxy(request: NextRequest) {
  const locale = getLocale(request);
  const pathname = request.nextUrl.pathname;

  // Set response and locale header
  const response = NextResponse.next();
  if (request.cookies.get('NEXT_LOCALE')?.value !== locale) {
    response.cookies.set('NEXT_LOCALE', locale, { path: '/' });
  }
  response.headers.set('x-locale', locale);

  // 403 Protection Logic (Dynamic Whitelist)
  // 1. Essential paths to prevent lock-out
  let isPublicPath = pathname === '/login' || pathname === '/register' || pathname === '/403' || pathname === '/admin-setup' || pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/uploads') || pathname === '/favicon.ico';

  // 2. Fetch dynamic whitelist
  if (!isPublicPath) {
    const whitelist = (await getWhitelist()) || [];
    for (const route of whitelist) {
      if (route.isPrefix) {
        if (pathname.startsWith(route.path)) {
          isPublicPath = true;
          break;
        }
      } else {
        if (pathname === route.path) {
          isPublicPath = true;
          break;
        }
      }
    }
  }

  if (!isPublicPath) {
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

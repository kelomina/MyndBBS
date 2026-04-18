import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { defaultLocale, locales } from './i18n/config';
import { getAccessRedirectPath, sortWhitelist, matchRoute } from './lib/routingGuard';

const isDev = process.env.NODE_ENV !== 'production';

function toBase64(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str);
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toBase64(bytes);
}

function buildCsp(nonce: string | null): string {
  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}'`
    : `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`;

  const connectSrc = isDev ? `connect-src 'self' ws:` : `connect-src 'self'`;

  return [
    `default-src 'self'`,
    scriptSrc,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self' data:`,
    connectSrc,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ].join('; ');
}

function normalizePathname(pathname: string): string {
  let p = pathname;
  if (p.length > 1) {
    p = p.replace(/\/+$/, '');
  }

  const parts = p.split('/');
  const maybeLocale = parts[1];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (maybeLocale && locales.includes(maybeLocale as any)) {
    const rest = parts.slice(2).join('/');
    return rest ? `/${rest}` : '/';
  }

  return p;
}

function getLocale(request: NextRequest): string {
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale && locales.includes(cookieLocale as (typeof locales)[number])) {
    return cookieLocale;
  }

  const acceptLang = request.headers.get('Accept-Language');
  if (acceptLang) {
    if (acceptLang.includes('zh')) return 'zh';
  }

  return defaultLocale;
}



type WhitelistRoute = { path: string; isPrefix: boolean; minRole?: string | null };

let cachedWhitelist: WhitelistRoute[] | null = null;
let lastFetchTime = 0;

const ROLE_LEVELS: Record<string, number> = {
  'USER': 1,
  'MODERATOR': 2,
  'ADMIN': 3,
  'SUPER_ADMIN': 4
};

async function getWhitelist(): Promise<WhitelistRoute[]> {
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
      const data = (await res.json()) as WhitelistRoute[];
      const normalizedData = data.map(route => ({
        ...route,
        path: normalizePathname(route.path)
      }));
      cachedWhitelist = sortWhitelist(normalizedData);
      lastFetchTime = now;
      return cachedWhitelist;
    }
  } catch (error) {
    console.error('ERR_FETCH_WHITELIST_FAILED', error);
  }
  return cachedWhitelist || [];
}

export async function middleware(request: NextRequest) {
  const nonce = isDev ? null : generateNonce();
  const requestHeaders = new Headers(request.headers);
  if (nonce) requestHeaders.set('x-nonce', nonce);

  const locale = getLocale(request);
  const pathname = normalizePathname(request.nextUrl.pathname);

  // Set response and locale header
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (request.cookies.get('NEXT_LOCALE')?.value !== locale) {
    response.cookies.set('NEXT_LOCALE', locale, { path: '/' });
  }
  response.headers.set('x-locale', locale);
  if (!isDev) response.headers.set('Content-Security-Policy', buildCsp(nonce));

  // 1. Essential paths to prevent lock-out
  const isEssentialPublic = pathname === '/login' || pathname === '/register' || pathname === '/403' || pathname === '/admin-setup' || pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/uploads') || pathname === '/favicon.ico';

  if (isEssentialPublic) return response;

  // 2. Fetch dynamic whitelist & find matching route
  const whitelist = (await getWhitelist()) || [];
  const matchedRoute = matchRoute(pathname, whitelist);

  // Determine required role level (0 = public, 4 = SUPER_ADMIN)
  // If no route matches, default to strictly requiring SUPER_ADMIN
  let requiredRoleLevel = 4;
  
  if (matchedRoute) {
    if (!matchedRoute.minRole) {
      requiredRoleLevel = 0; // Public
    } else {
      requiredRoleLevel = ROLE_LEVELS[matchedRoute.minRole] || 4;
    }
  }

  if (requiredRoleLevel > 0) {
    const token = request.cookies.get('accessToken')?.value;
    let userRoleLevel = 0;

    if (token) {
      try {
        const payload = token.split('.')[1];
        let b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        const decoded = atob(b64);
        const parsed = JSON.parse(decoded);
        
        userRoleLevel = ROLE_LEVELS[parsed.role] || 0;
      } catch {
      }
    }

    const redirectPath = getAccessRedirectPath(requiredRoleLevel, userRoleLevel);
    if (redirectPath) {
      const url = request.nextUrl.clone();
      url.pathname = redirectPath;

      // Preserve locale cookie on redirect
      const redirectResponse = NextResponse.redirect(url);
      if (request.cookies.get('NEXT_LOCALE')?.value !== locale) {
        redirectResponse.cookies.set('NEXT_LOCALE', locale, { path: '/' });
      }
      if (!isDev) redirectResponse.headers.set('Content-Security-Policy', buildCsp(nonce));
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

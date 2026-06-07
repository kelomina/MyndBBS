import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { defaultLocale, locales, type Locale } from '../i18n/config';

export interface MiddlewareContext {
  nonce: string | null;
  locale: string;
  pathname: string;
  accessToken: string | null;
  refreshedAccessToken: string | null;
  userRole: string | null;
  matchedRoute: WhitelistRoute | null;
  response: NextResponse;
}

export type WhitelistRoute = {
  path: string;
  isPrefix: boolean;
  minRole?: string | null;
  description?: string | null;
};

export type MiddlewareResult = NextResponse | null;

export const ROLE_LEVELS: Record<string, number> = {
  USER: 1,
  MODERATOR: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

export function initMiddlewareContext(request: NextRequest): MiddlewareContext {
  const isDev = process.env.NODE_ENV !== 'production';
  const nonce = isDev ? null : generateNonce();
  const requestHeaders = new Headers(request.headers);
  if (nonce) {
    requestHeaders.set('x-nonce', nonce);
  }

  const locale = getLocale(request);
  const pathname = normalizePathname(request.nextUrl.pathname);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (request.cookies.get('NEXT_LOCALE')?.value !== locale) {
    response.cookies.set('NEXT_LOCALE', locale, { path: '/' });
  }
  response.headers.set('x-locale', locale);

  return {
    nonce,
    locale,
    pathname,
    accessToken: request.cookies.get('accessToken')?.value ?? null,
    refreshedAccessToken: null,
    userRole: null,
    matchedRoute: null,
    response,
  };
}

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

export function normalizePathname(pathname: string): string {
  let p = pathname;
  if (p.length > 1) {
    p = p.replace(/\/+$/, '');
  }

  const parts = p.split('/');
  const maybeLocale = parts[1];
  if (maybeLocale && locales.includes(maybeLocale as Locale)) {
    const rest = parts.slice(2).join('/');
    return rest ? `/${rest}` : '/';
  }

  return p;
}

function getLocale(request: NextRequest): string {
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return cookieLocale;
  }

  const acceptLang = request.headers.get('Accept-Language');
  if (acceptLang?.includes('zh')) {
    return 'zh';
  }

  return defaultLocale;
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { defaultLocale, locales } from './i18n/config';
import { sortWhitelist, matchRoute } from './lib/routingGuard';

const isDev = process.env.NODE_ENV !== 'production';
const ESSENTIAL_PUBLIC_PATHS = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/403',
  '/admin-setup',
  '/terms',
  '/privacy',
]);

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
    `style-src-attr 'self'`,
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
  if (maybeLocale && locales.includes(maybeLocale as (typeof locales)[number])) {
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
  if (acceptLang?.includes('zh')) {
    return 'zh';
  }

  return defaultLocale;
}

/**
 * Callers: [proxy]
 * Callees: []
 * Description: Determines whether a pathname must remain publicly accessible before dynamic whitelist lookup succeeds.
 * 描述：判断某个路径是否必须在动态白名单加载前保持公开可访问。
 * Variables: `pathname` is the locale-normalized request pathname.
 * 变量：`pathname` 表示完成 locale 归一化后的请求路径。
 * Integration: Call this helper before dynamic whitelist fetches to prevent public legal/auth routes from being locked behind admin access.
 * 接入方式：在拉取动态白名单前调用，避免公开的法律页和认证页被错误锁成管理入口。
 * Error Handling: Returns `true` for known public prefixes and files, otherwise `false`; it never throws.
 * 错误处理：已知公开路径或静态资源返回 `true`，其余情况返回 `false`，不会抛出异常。
 * Keywords: public route, whitelist, proxy, auth, legal, 公共路由, 白名单, 代理, 认证, 法律页面
 */
function isEssentialPublicPath(pathname: string): boolean {
  return (
    ESSENTIAL_PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/uploads') ||
    pathname === '/favicon.ico'
  );
}

type WhitelistRoute = { path: string; isPrefix: boolean; minRole?: string | null };

let cachedWhitelist: WhitelistRoute[] | null = null;
let lastFetchTime = 0;

async function getWhitelist(): Promise<WhitelistRoute[]> {
  const now = Date.now();
  if (cachedWhitelist && now - lastFetchTime < 30000) {
    return cachedWhitelist;
  }
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
    const res = await fetch(`${apiUrl}/api/public/routing-whitelist`, {
      next: { revalidate: 30 },
    });
    if (res.ok) {
      const data = (await res.json()) as WhitelistRoute[];
      const normalizedData = data.map((route) => ({
        ...route,
        path: normalizePathname(route.path),
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

export async function proxy(request: NextRequest) {
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
  if (!isDev) {
    response.headers.set('Content-Security-Policy', buildCsp(nonce));
  }

  const isEssentialPublic = isEssentialPublicPath(pathname);

  if (isEssentialPublic) {
    return response;
  }

  const whitelist = (await getWhitelist()) || [];
  const matchedRoute = matchRoute(pathname, whitelist);

  let routeProtected = true;

  if (matchedRoute) {
    if (!matchedRoute.minRole) {
      routeProtected = false;
    }
  }

  if (routeProtected) {
    const hasToken = !!request.cookies.get('accessToken')?.value;

    if (!hasToken) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';

      const redirectResponse = NextResponse.redirect(url);
      if (request.cookies.get('NEXT_LOCALE')?.value !== locale) {
        redirectResponse.cookies.set('NEXT_LOCALE', locale, { path: '/' });
      }
      if (!isDev) {
        redirectResponse.headers.set('Content-Security-Policy', buildCsp(nonce));
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

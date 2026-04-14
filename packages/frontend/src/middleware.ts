import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { defaultLocale, locales } from './i18n/config';

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

/**
 * Callers: []
 * Callees: [get, includes]
 * Description: Handles the get locale logic for the application.
 * Keywords: getlocale, get, locale, auto-annotated
 */
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

const ROLE_LEVELS: Record<string, number> = {
  'USER': 1,
  'MODERATOR': 2,
  'ADMIN': 3,
  'SUPER_ADMIN': 4
};

/**
 * Callers: []
 * Callees: [now, fetch, json, sort, error]
 * Description: Handles the get whitelist logic for the application.
 * Keywords: getwhitelist, get, whitelist, auto-annotated
 */
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
      const data = await res.json();
      // Sort: exact matches first, then longest prefixes
/**
 * Callers: [getWhitelist]
 * Callees: []
 * Description: An anonymous sorting callback to order whitelist paths.
 * Keywords: proxy, sort, whitelist, paths, anonymous
 */
      data.sort((a: any, b: any) => {
        if (!a.isPrefix && b.isPrefix) return -1;
        if (a.isPrefix && !b.isPrefix) return 1;
        return b.path.length - a.path.length;
      });
      cachedWhitelist = data;
      lastFetchTime = now;
      return cachedWhitelist;
    }
  } catch (e) {
    console.error('Failed to fetch routing whitelist in proxy:', e);
  }
  return cachedWhitelist || [];
}

/**
 * Callers: []
 * Callees: [getLocale, next, get, set, startsWith, getWhitelist, split, replace, atob, parse, clone, redirect]
 * Description: Handles the proxy logic for the application.
 * Keywords: proxy, auto-annotated
 */
export async function middleware(request: NextRequest) {
  const locale = getLocale(request);
  const pathname = normalizePathname(request.nextUrl.pathname);

  // Set response and locale header
  const response = NextResponse.next();
  if (request.cookies.get('NEXT_LOCALE')?.value !== locale) {
    response.cookies.set('NEXT_LOCALE', locale, { path: '/' });
  }
  response.headers.set('x-locale', locale);

  // 1. Essential paths to prevent lock-out
  const isEssentialPublic = pathname === '/login' || pathname === '/register' || pathname === '/403' || pathname === '/admin-setup' || pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/uploads') || pathname === '/favicon.ico';

  if (isEssentialPublic) return response;

  // 2. Fetch dynamic whitelist & find matching route
  const whitelist = (await getWhitelist()) || [];
  let matchedRoute: any = null;

  for (const route of whitelist) {
    const routePath = normalizePathname(route.path);
    if (route.isPrefix) {
      if (routePath === '/' || pathname === routePath || pathname.startsWith(`${routePath}/`)) {
        matchedRoute = route;
        break;
      }
    } else {
      if (pathname === routePath) {
        matchedRoute = route;
        break;
      }
    }
  }

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
      } catch (e) {
        // ignore
      }
    }

    if (userRoleLevel < requiredRoleLevel) {
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

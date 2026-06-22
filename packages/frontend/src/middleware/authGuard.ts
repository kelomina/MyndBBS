import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { MiddlewareContext, MiddlewareResult } from './types';
import { matchRoute } from '../lib/routingGuard';
import { getWhitelist } from './routeWhitelist';

const ESSENTIAL_PUBLIC_PATHS = new Set([
  '/',
  '/install',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/403',
  '/admin-setup',
  '/terms',
  '/privacy',
]);

function isEssentialPublicPath(pathname: string): boolean {
  const isPublicUploadedImage = /^\/uploads\/messages\/[^/]+\.(?:jpe?g|png|gif|webp|bmp|tiff?)$/i.test(pathname);

  return (
    ESSENTIAL_PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith('/install') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/public') ||
    pathname.startsWith('/uploads/avatars') ||
    isPublicUploadedImage ||
    pathname === '/favicon.ico'
  );
}

export async function guardRouteAccess(request: NextRequest, ctx: MiddlewareContext): Promise<MiddlewareResult> {
  const isEssentialPublic = isEssentialPublicPath(ctx.pathname);
  if (isEssentialPublic) {
    return null;
  }

  const whitelist = await getWhitelist();
  const matchedRoute = matchRoute(ctx.pathname, whitelist);
  ctx.matchedRoute = matchedRoute;

  if (!matchedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/403';
    const redirectResponse = NextResponse.redirect(url);
    if (request.cookies.get('NEXT_LOCALE')?.value !== ctx.locale) {
      redirectResponse.cookies.set('NEXT_LOCALE', ctx.locale, { path: '/' });
    }
    return redirectResponse;
  }

  if (!matchedRoute!.minRole) {
    return null;
  }

  const hasSession = !!request.cookies.get('sessionId')?.value || !!ctx.sessionId;
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const redirectResponse = NextResponse.redirect(url);
    if (request.cookies.get('NEXT_LOCALE')?.value !== ctx.locale) {
      redirectResponse.cookies.set('NEXT_LOCALE', ctx.locale, { path: '/' });
    }
    return redirectResponse;
  }

  return null;
}

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
  '/terms',
  '/privacy',
]);

function isEssentialPublicPath(pathname: string): boolean {
  const isPublicUploadedImage = /^\/uploads\/messages\/[^/]+\.(?:jpe?g|png|gif|webp|bmp|tiff?)$/i.test(pathname);

  return (
    ESSENTIAL_PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith('/install') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/uploads/avatars') ||
    isPublicUploadedImage ||
    pathname === '/favicon.ico'
  );
}

export async function guardRouteAccess(request: NextRequest, ctx: MiddlewareContext): Promise<MiddlewareResult> {
  if (ctx.pathname === '/admin-setup') {
    const hasSetupToken = !!request.cookies.get('tempToken')?.value;
    const hasSession = !!request.cookies.get('sessionId')?.value || !!ctx.sessionId;

    // 管理员安全设置页只服务于安装/注册后续流程，不能作为公开介绍页裸露。
    if (hasSetupToken || hasSession) {
      return null;
    }

    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const redirectResponse = NextResponse.redirect(url);
    if (request.cookies.get('NEXT_LOCALE')?.value !== ctx.locale) {
      redirectResponse.cookies.set('NEXT_LOCALE', ctx.locale, { path: '/' });
    }
    return redirectResponse;
  }

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

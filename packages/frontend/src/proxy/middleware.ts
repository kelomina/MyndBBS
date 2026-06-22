import type { NextRequest } from 'next/server';
import { initMiddlewareContext, type MiddlewareResult } from './middlewareContext';
import { applyCspHeaders } from './csp';
import { filterMaliciousPaths } from './maliciousPathFilter';
import { detectLocale } from './localeDetector';
import { guardInstallStatus } from './installGuard';
import { guardRouteAccess } from './routeGuard';

type MiddlewareStep = (request: NextRequest, ctx: ReturnType<typeof initMiddlewareContext>) => Promise<MiddlewareResult> | MiddlewareResult;

const pipeline: MiddlewareStep[] = [
  applyCspHeaders,
  filterMaliciousPaths,
  detectLocale,
  guardInstallStatus,
  guardRouteAccess,
];

export async function proxy(request: NextRequest) {
  const ctx = initMiddlewareContext(request);

  for (const step of pipeline) {
    const result = await step(request, ctx);
    if (result) return result;
  }

  return ctx.response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { MiddlewareContext, MiddlewareResult } from './middlewareContext';

export async function guardInstallStatus(request: NextRequest, ctx: MiddlewareContext): Promise<MiddlewareResult> {
  try {
    const apiUrl = process.env.API_URL || 'http://127.0.0.1:3001';
    const statusRes = await fetch(`${apiUrl}/api/public/install-status`, {
      signal: AbortSignal.timeout(3000),
    });
    if (statusRes.ok) {
      const status = await statusRes.json();
      if (!status.setupRequired && ctx.pathname.startsWith('/install')) {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
      if (status.setupRequired && !ctx.pathname.startsWith('/install')) {
        const url = request.nextUrl.clone();
        url.pathname = '/install';
        return NextResponse.redirect(url);
      }
    }
  } catch {
    if (!ctx.pathname.startsWith('/install')) {
      const url = request.nextUrl.clone();
      url.pathname = '/install';
      return NextResponse.redirect(url);
    }
  }
  return null;
}

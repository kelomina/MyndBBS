import type { NextRequest } from 'next/server';
import type { MiddlewareContext, MiddlewareResult } from './middlewareContext';

const isDev = process.env.NODE_ENV !== 'production';

function buildCsp(nonce: string | null): string {
  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}'`
    : `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`;

  const connectSrc = isDev ? `connect-src 'self' ws:` : `connect-src 'self'`;
  const styleSrc = isDev
    ? `style-src 'self' 'unsafe-inline'`
    : nonce
      ? `style-src 'self' 'nonce-${nonce}'`
      : `style-src 'self'`;
  const styleSrcAttr = isDev ? `style-src-attr 'self' 'unsafe-inline'` : `style-src-attr 'none'`;

  return [
    `default-src 'self'`,
    scriptSrc,
    styleSrc,
    styleSrcAttr,
    `img-src 'self' blob: data:`,
    `font-src 'self' data:`,
    connectSrc,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ].join('; ');
}

export function applyCspHeaders(_request: NextRequest, ctx: MiddlewareContext): MiddlewareResult {
  if (!ctx.pathname.startsWith('/install')) {
    ctx.response.headers.set('Content-Security-Policy', buildCsp(ctx.nonce));
  }
  return null;
}

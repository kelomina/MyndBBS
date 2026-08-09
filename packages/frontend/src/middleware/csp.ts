import type { NextRequest } from 'next/server';
import type { MiddlewareContext, MiddlewareResult } from './types';

const isDev = process.env.NODE_ENV !== 'production';

// Post detail pages render KaTeX math, which relies on inline `style`
// attributes (strut heights, spacing, script sizing). Only those routes relax
// `style-src-attr`; everywhere else inline style attributes stay blocked.
const MATH_RENDERING_ROUTE_PREFIX = '/p/';

function buildCsp(nonce: string | null, allowInlineStyleAttrs: boolean): string {
  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}'`
    : `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`;

  const connectSrc = isDev ? `connect-src 'self' ws:` : `connect-src 'self'`;
  const styleSrc = isDev
    ? `style-src 'self' 'unsafe-inline'`
    : nonce
      ? `style-src 'self' 'nonce-${nonce}'`
      : `style-src 'self'`;
  const styleSrcAttr =
    isDev || allowInlineStyleAttrs
      ? `style-src-attr 'unsafe-inline'`
      : `style-src-attr 'none'`;

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
    const allowInlineStyleAttrs = ctx.pathname.startsWith(MATH_RENDERING_ROUTE_PREFIX);
    ctx.response.headers.set('Content-Security-Policy', buildCsp(ctx.nonce, allowInlineStyleAttrs));
    ctx.response.headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
    ctx.response.headers.set('Cross-Origin-Resource-Policy', 'same-site');
    ctx.response.headers.set('X-XSS-Protection', '0');
  }
  return null;
}

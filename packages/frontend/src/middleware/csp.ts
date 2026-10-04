import type { NextRequest } from 'next/server';
import type { MiddlewareContext, MiddlewareResult } from './types';

const isDev = process.env.NODE_ENV !== 'production';

// Post detail pages render KaTeX math, which relies on inline `style`
// attributes (strut heights, spacing, script sizing). Only those routes relax
// `style-src-attr`; everywhere else inline style attributes stay blocked.
const MATH_RENDERING_ROUTE_PREFIX = '/p/';

// Middleware response headers can replace Route Handler/BFF headers. Plugin HTML
// must retain an opaque-origin sandbox even when opened directly via the BFF URL.
const PLUGIN_UI_RESPONSE_CSP = "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'self'";
const PLUGIN_UI_PATH = /^\/api\/plugins\/[^/]+\/__ui(?:\/|$)/i;

function isPluginUiPath(pathname: string): boolean {
  try {
    // Next decodes catch-all params once, then the BFF joins them into a fetch URL.
    // Mirror both operations (including encoded slashes/dot-segment normalization)
    // so equivalent URLs cannot receive the core page's less restrictive CSP.
    const decoded = pathname.split('/').map((segment) => decodeURIComponent(segment)).join('/');
    return PLUGIN_UI_PATH.test(new URL('https://plugin.invalid' + decoded).pathname);
  } catch {
    // The malicious-path filter rejects malformed encodings with 404 before routing.
    return false;
  }
}

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
    ctx.response.headers.set('Content-Security-Policy', isPluginUiPath(ctx.pathname)
      ? PLUGIN_UI_RESPONSE_CSP
      : buildCsp(ctx.nonce, allowInlineStyleAttrs));
    ctx.response.headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
    ctx.response.headers.set('Cross-Origin-Resource-Policy', 'same-site');
    ctx.response.headers.set('X-XSS-Protection', '0');
  }
  return null;
}

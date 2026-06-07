export const ALLOWED_EMAIL_PREVIEW_TAGS = new Set([
  'p',
  'br',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'a',
  'table',
  'tr',
  'td',
  'th',
  'thead',
  'tbody',
  'div',
  'span',
]);

export const ALLOWED_EMAIL_PREVIEW_HREF_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function escapeEmailPreviewHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeEmailPreviewHref(rawHref: string): string | null {
  const decodedHref = rawHref.replace(/&amp;/g, '&').trim();
  if (!decodedHref) {
    return null;
  }

  if (/^{{[A-Za-z0-9_.-]+}}$/.test(decodedHref)) {
    return escapeEmailPreviewHtml(decodedHref);
  }

  try {
    const parsed = new URL(decodedHref);
    return ALLOWED_EMAIL_PREVIEW_HREF_PROTOCOLS.has(parsed.protocol)
      ? escapeEmailPreviewHtml(decodedHref)
      : null;
  } catch {
    if (decodedHref.startsWith('/') || decodedHref.startsWith('#')) {
      return escapeEmailPreviewHtml(decodedHref);
    }
    return null;
  }
}

export function sanitizeEmailPreviewHtml(htmlBody: string): string {
  return htmlBody
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?\s*>/gi, '')
    .replace(/<\/?([a-zA-Z][\w:-]*)([^>]*)>/g, (fullMatch, rawTagName, rawAttributes) => {
      const tagName = String(rawTagName).toLowerCase();
      if (!ALLOWED_EMAIL_PREVIEW_TAGS.has(tagName)) {
        return '';
      }

      if (fullMatch.startsWith('</')) {
        return tagName === 'br' ? '' : `</${tagName}>`;
      }

      if (tagName !== 'a') {
        return `<${tagName}>`;
      }

      const attributes = String(rawAttributes).replace(/\s+on[a-zA-Z]+\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+)/gi, '');
      const hrefMatch = attributes.match(/\s+href\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
      const href = hrefMatch
        ? sanitizeEmailPreviewHref(hrefMatch[2] ?? hrefMatch[3] ?? hrefMatch[4] ?? '')
        : null;
      return href ? `<a href="${href}">` : '<a>';
    });
}

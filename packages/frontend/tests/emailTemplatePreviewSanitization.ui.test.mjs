import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('admin email preview sanitizes HTML before dangerouslySetInnerHTML', async () => {
  const pagePath = path.join(process.cwd(), 'src', 'app', 'admin', 'email', 'page.tsx');
  const content = await fs.readFile(pagePath, 'utf-8');

  assert.equal(
    content.includes('function sanitizeEmailPreviewHtml(htmlBody: string): string'),
    true,
    'Missing local email preview sanitizer'
  );
  assert.equal(
    content.includes('renderedHtml = renderedHtml.split(ph).join(escapeEmailPreviewHtml(value));'),
    true,
    'Preview variable values must be HTML-escaped before local rendering'
  );
  assert.equal(
    content.includes('htmlBody: sanitizeEmailPreviewHtml(renderedHtml)'),
    true,
    'Preview HTML must be sanitized before being passed to React rendering'
  );
  assert.equal(
    content.includes('^{{[A-Za-z0-9_.-]+}}$'),
    true,
    'Preview sanitizer should preserve href placeholders until variable rendering'
  );
  assert.equal(
    content.includes('dangerouslySetInnerHTML={{ __html: preview.htmlBody }}'),
    true,
    'dangerouslySetInnerHTML should only consume the sanitized preview value'
  );
  assert.match(content, /script\|style\|iframe\|object\|embed\|link\|meta/);
  assert.match(content, /ALLOWED_EMAIL_PREVIEW_HREF_PROTOCOLS/);
});

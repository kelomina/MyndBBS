import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('admin email preview sanitizes HTML before dangerouslySetInnerHTML', async () => {
  const pagePath = path.join(process.cwd(), 'src', 'app', 'admin', 'email', 'page.tsx');
  const content = await fs.readFile(pagePath, 'utf-8');

  assert.equal(
    content.includes("import { escapeEmailPreviewHtml, sanitizeEmailPreviewHtml } from '../../../lib/emailPreviewSanitizer';"),
    true,
    'Email page should use shared sanitizer'
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
    content.includes('dangerouslySetInnerHTML={{ __html: preview.htmlBody }}'),
    true,
    'dangerouslySetInnerHTML should only consume the sanitized preview value'
  );
  const sanitizerPath = path.join(process.cwd(), 'src', 'lib', 'emailPreviewSanitizer.ts');
  const sanitizer = await fs.readFile(sanitizerPath, 'utf-8');
  assert.equal(
    sanitizer.includes('^{{[A-Za-z0-9_.-]+}}$'),
    true,
    'Preview sanitizer should preserve href placeholders until variable rendering'
  );
  assert.match(sanitizer, /script\|style\|iframe\|object\|embed\|link\|meta/);
  assert.match(sanitizer, /ALLOWED_EMAIL_PREVIEW_HREF_PROTOCOLS/);
});

test('admin email preview sanitizer strips event handler attributes', async () => {
  const { sanitizeEmailPreviewHtml } = await import(`../src/lib/emailPreviewSanitizer.ts?cacheBust=${Date.now()}`);

  const sanitized = sanitizeEmailPreviewHtml('<a href="https://example.com" onclick="alert(1)">safe</a><svg onload="alert(1)"></svg>');

  assert.equal(sanitized.includes('onclick'), false);
  assert.equal(sanitized.includes('onload'), false);
  assert.equal(sanitized.includes('<svg'), false);
  assert.equal(sanitized, '<a href="https://example.com">safe</a>');
});

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

test('frontend can leave proxy-owned duplicate headers to OpenResty', async () => {
  const nextConfig = await fs.readFile(new URL('../next.config.ts', import.meta.url), 'utf-8');
  const dockerfile = await fs.readFile(path.join(projectRoot, 'Dockerfile'), 'utf-8');

  assert.match(
    nextConfig,
    /const proxyOwnsDuplicateSecurityHeaders = process\.env\.SECURITY_HEADERS_OWNER === 'proxy'/,
  );
  assert.match(nextConfig, /\.\.\.\(!proxyOwnsDuplicateSecurityHeaders/);
  assert.match(dockerfile, /SECURITY_HEADERS_OWNER=proxy/);
});

test('production CSP does not allow inline style attributes', async () => {
  const proxyCsp = await fs.readFile(new URL('../src/proxy/csp.ts', import.meta.url), 'utf-8');
  const middlewareCsp = await fs.readFile(new URL('../src/middleware/csp.ts', import.meta.url), 'utf-8');

  for (const source of [proxyCsp, middlewareCsp]) {
    assert.match(source, /style-src-attr 'none'/);
    assert.match(source, /style-src 'self' 'nonce-\$\{nonce\}'/);
  }
});

test('install guard consumes setupRequired instead of installed fingerprint', async () => {
  const proxyGuard = await fs.readFile(new URL('../src/proxy/installGuard.ts', import.meta.url), 'utf-8');
  const middlewareGuard = await fs.readFile(new URL('../src/middleware/installGuard.ts', import.meta.url), 'utf-8');

  for (const source of [proxyGuard, middlewareGuard]) {
    assert.match(source, /status\.setupRequired/);
    assert.doesNotMatch(source, /status\.installed/);
  }
});

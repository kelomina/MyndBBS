const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');

test('backend leaves proxy-owned duplicate headers to OpenResty', async () => {
  const indexSource = await fs.readFile(path.join(process.cwd(), 'src', 'index.ts'), 'utf-8');

  assert.match(
    indexSource,
    /const proxyOwnsDuplicateSecurityHeaders = process\.env\.TRUST_PROXY === 'true'/,
  );
  assert.match(indexSource, /xContentTypeOptions:\s*!proxyOwnsDuplicateSecurityHeaders/);
  assert.match(
    indexSource,
    /xFrameOptions:\s*proxyOwnsDuplicateSecurityHeaders\s*\?\s*false\s*:\s*\{\s*action:\s*'sameorigin'\s*\}/,
  );
});

test('public install status exposes setupRequired instead of installed fingerprint', async () => {
  const indexSource = await fs.readFile(path.join(process.cwd(), 'src', 'index.ts'), 'utf-8');

  assert.match(indexSource, /res\.json\(\{\s*setupRequired:\s*process\.env\.INSTALL_LOCKED !== 'true'\s*\}\)/);
  assert.doesNotMatch(indexSource, /installed:\s*process\.env\.INSTALL_LOCKED/);
});

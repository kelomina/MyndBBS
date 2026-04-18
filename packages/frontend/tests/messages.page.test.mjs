import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('messages page includes CSRF token in fetch calls', async (t) => {
  const pagePath = path.join(process.cwd(), 'src', 'app', 'messages', 'page.tsx');
  const pageContent = await fs.readFile(pagePath, 'utf-8');

  await t.test('fetch calls in handleInitSecureMessaging should include X-Requested-With header', () => {
    // Check if the POST fetch contains the CSRF header
    const containsCSRFHeader = pageContent.includes("'X-Requested-With': 'XMLHttpRequest'");
    assert.equal(containsCSRFHeader, true, 'The CSRF token header should be present in the fetch options');
  });
});

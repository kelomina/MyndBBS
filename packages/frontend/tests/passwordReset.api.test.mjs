import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const passwordResetApiPath = new URL('../src/lib/api/passwordReset.ts', import.meta.url);

test('requestPasswordReset keeps using the shared fetcher and POST body serialization', async () => {
  const source = await fs.readFile(passwordResetApiPath, 'utf8');

  assert.match(source, /import\s+\{\s*fetcher\s*\}\s+from\s+'\.\/fetcher';/);
  assert.match(source, /export async function requestPasswordReset/);
  assert.match(source, /method:\s*'POST'/);
  assert.match(source, /body:\s*JSON\.stringify\(payload\)/);
});

test('resetPassword posts the reset token and replacement password through the shared fetcher', async () => {
  const source = await fs.readFile(passwordResetApiPath, 'utf8');

  assert.match(source, /export async function resetPassword/);
  assert.match(source, /body:\s*JSON\.stringify\(payload\)/);
});

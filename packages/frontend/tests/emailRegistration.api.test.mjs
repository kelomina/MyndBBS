import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const emailRegistrationApiPath = new URL('../src/lib/api/emailRegistration.ts', import.meta.url);

test('startEmailRegistration keeps using the shared fetcher and POST body serialization', async () => {
  const source = await fs.readFile(emailRegistrationApiPath, 'utf8');

  assert.match(source, /import\s+\{\s*fetcher\s*\}\s+from\s+'\.\/fetcher';/);
  assert.match(source, /export async function startEmailRegistration/);
  assert.match(source, /method:\s*'POST'/);
  assert.match(source, /body:\s*JSON\.stringify\(payload\)/);
});

test('verifyEmailRegistration posts the mailbox token in the verification request body', async () => {
  const source = await fs.readFile(emailRegistrationApiPath, 'utf8');

  assert.match(source, /export async function verifyEmailRegistration/);
  assert.match(source, /body:\s*JSON\.stringify\(\{\s*token\s*\}\)/);
});

test('resendEmailRegistration reuses the shared fetcher with a POST mailbox payload', async () => {
  const source = await fs.readFile(emailRegistrationApiPath, 'utf8');

  assert.match(source, /export async function resendEmailRegistration/);
  assert.match(source, /body:\s*JSON\.stringify\(payload\)/);
});

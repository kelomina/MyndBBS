import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('twoFactor API helpers use the shared fetcher contract', async (t) => {
  const twoFactorPath = path.join(process.cwd(), 'src', 'lib', 'api', 'twoFactor.ts');
  const content = await fs.readFile(twoFactorPath, 'utf-8');

  await t.test('should keep using the shared fetcher helper', () => {
    assert.equal(
      content.includes("import { fetcher } from './fetcher';"),
      true,
      'Missing shared fetcher import'
    );
  });

  await t.test('should send POST for TOTP setup and disable endpoints', () => {
    assert.equal(content.includes("method: 'POST'"), true, 'Missing POST calls for TOTP helpers');
    assert.equal(content.includes('export async function generateTotp'), true, 'Missing generateTotp helper');
    assert.equal(content.includes('export async function disableTotp'), true, 'Missing disableTotp helper');
  });

  await t.test('should serialize verification payloads with code and challengeId', () => {
    assert.equal(
      content.includes('body: JSON.stringify({ code })'),
      true,
      'Missing serialized TOTP verification body'
    );
    assert.equal(
      content.includes('body: JSON.stringify({ response, challengeId })'),
      true,
      'Missing serialized passkey verification body'
    );
  });
});

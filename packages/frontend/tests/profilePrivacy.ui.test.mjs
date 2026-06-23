import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('public profile page does not render role or pass internal user id to client controls', async () => {
  const pagePath = path.join(process.cwd(), 'src', 'app', 'u', '[username]', 'page.tsx');
  const ownerButtonPath = path.join(process.cwd(), 'src', 'app', 'u', '[username]', 'OwnerSettingsButton.tsx');
  const pageContent = await fs.readFile(pagePath, 'utf-8');
  const ownerButtonContent = await fs.readFile(ownerButtonPath, 'utf-8');

  assert.doesNotMatch(pageContent, /user\.role/);
  assert.doesNotMatch(pageContent, /userId=\{user\.id\}/);
  assert.match(pageContent, /<OwnerSettingsButton username=\{user\.username\} \/>/);
  assert.match(ownerButtonContent, /addresseeUsername: username/);
  assert.doesNotMatch(ownerButtonContent, /addresseeId: userId/);
});

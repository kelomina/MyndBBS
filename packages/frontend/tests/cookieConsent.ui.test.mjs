import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('Cookie Consent Modal logic checks', async (t) => {
  const modalPath = path.join(process.cwd(), 'src', 'components', 'CookieConsentModal.tsx');
  const content = await fs.readFile(modalPath, 'utf-8');

  await t.test('Should fetch /api/v1/user/profile to check consent', () => {
    assert.equal(
      content.includes('/api/v1/user/profile'),
      true,
      'Missing API call to check user profile'
    );
  });

  await t.test('Should save preferences to /api/v1/user/cookie-preferences', () => {
    assert.equal(
      content.includes('/api/v1/user/cookie-preferences'),
      true,
      'Missing PUT API call to save preferences'
    );
  });

  await t.test('Should save preferences to localStorage', () => {
    assert.equal(
      content.includes('localStorage.setItem(\'myndbbs_cookie_consent\''),
      true,
      'Missing localStorage logic'
    );
  });
});

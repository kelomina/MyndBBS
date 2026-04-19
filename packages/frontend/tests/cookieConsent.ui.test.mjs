import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('Cookie Consent Modal logic checks', async (t) => {
  const modalPath = path.join(process.cwd(), 'src', 'components', 'CookieConsentModal.tsx');
  const content = await fs.readFile(modalPath, 'utf-8');

  await t.test('Should check localStorage before making API calls', () => {
    assert.equal(
      content.includes('const localConsent = localStorage.getItem(\'myndbbs_cookie_consent\');'),
      true,
      'Missing initial localStorage check'
    );
    assert.equal(
      content.includes('if (localConsent) {'),
      true,
      'Missing early return for localConsent'
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

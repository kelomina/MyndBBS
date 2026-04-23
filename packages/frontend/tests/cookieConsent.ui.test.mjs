import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('Cookie Consent Modal logic checks', async (t) => {
  const modalPath = path.join(process.cwd(), 'src', 'components', 'CookieConsentModal.tsx');
  const content = await fs.readFile(modalPath, 'utf-8');

  await t.test('Should define a reusable local storage key', () => {
    assert.equal(
      content.includes('const COOKIE_CONSENT_STORAGE_KEY = \'myndbbs_cookie_consent\';'),
      true,
      'Missing cookie consent storage key constant'
    );
  });

  await t.test('Should reconcile local and remote preferences before opening the modal', () => {
    assert.equal(
      content.includes('const localPreferences = readStoredCookiePreferences();'),
      true,
      'Missing local preference reconciliation'
    );
    assert.equal(
      content.includes('await fetch(\'/api/v1/user/profile\''),
      true,
      'Missing profile fetch for consent reconciliation'
    );
    assert.equal(
      content.includes('await persistCookiePreferences(localPreferences);'),
      true,
      'Missing account backfill when only local consent exists'
    );
    assert.equal(
      content.includes('writeStoredCookiePreferences(remotePreferences);'),
      true,
      'Missing device sync when remote consent exists'
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
      content.includes('writeStoredCookiePreferences(prefs);'),
      true,
      'Missing localStorage logic'
    );
  });
});

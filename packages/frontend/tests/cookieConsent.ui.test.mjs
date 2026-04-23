import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('Cookie Consent Modal logic checks', async (t) => {
  const modalPath = path.join(process.cwd(), 'src', 'components', 'CookieConsentModal.tsx');
  const sharedModulePath = path.join(process.cwd(), 'src', 'lib', 'cookiePreferences.ts');
  const modalContent = await fs.readFile(modalPath, 'utf-8');
  const sharedContent = await fs.readFile(sharedModulePath, 'utf-8');

  await t.test('Should define the reusable local storage key in the shared module', () => {
    assert.equal(
      sharedContent.includes("export const COOKIE_CONSENT_STORAGE_KEY = 'myndbbs_cookie_consent';"),
      true,
      'Missing cookie consent storage key constant in shared module'
    );
  });

  await t.test('Should keep local and remote reconciliation in the shared module', () => {
    assert.equal(
      sharedContent.includes("await fetch('/api/v1/user/profile'"),
      true,
      'Missing profile fetch for consent reconciliation'
    );
    assert.equal(
      sharedContent.includes('await persistCookiePreferences(localPreferences);'),
      true,
      'Missing account backfill when only local consent exists'
    );
    assert.equal(
      sharedContent.includes('writeStoredCookiePreferences(remotePreferences);'),
      true,
      'Missing device sync when remote consent exists'
    );
  });

  await t.test('Should let the modal consume the shared reconciliation flow', () => {
    assert.equal(
      modalContent.includes("from '@/lib/cookiePreferences'"),
      true,
      'Missing shared cookie preference module import'
    );
    assert.equal(
      modalContent.includes('const result = await reconcileCookiePreferences();'),
      true,
      'Missing shared reconciliation call in consent modal'
    );
  });

  await t.test('Should save preferences through the shared module', () => {
    assert.equal(
      sharedContent.includes('/api/v1/user/cookie-preferences'),
      true,
      'Missing PUT API call in shared save flow'
    );
    assert.equal(
      modalContent.includes('await saveCookiePreferences(prefs);'),
      true,
      'Missing shared save flow in consent modal'
    );
  });
});

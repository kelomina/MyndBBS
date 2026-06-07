import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('Settings Page - Privacy & Legal Options', async (t) => {
  const settingsPagePath = path.join(process.cwd(), 'src', 'app', 'u', 'settings', 'page.tsx');
  const privacySettingsPath = path.join(process.cwd(), 'src', 'components', 'PrivacySettings.tsx');
  const sharedModulePath = path.join(process.cwd(), 'src', 'lib', 'cookiePreferences.ts');

  await t.test('Settings page should have a privacy tab', async () => {
    const content = await fs.readFile(settingsPagePath, 'utf-8');
    assert.equal(
      content.includes("setActiveTab('privacy')"),
      true,
      'Missing privacy tab button in settings page'
    );
    assert.equal(
      content.includes('<PrivacySettings />'),
      true,
      'Missing PrivacySettings component rendering'
    );
  });

  await t.test('PrivacySettings component should reuse the shared cookie module and keep legal links', async () => {
    const content = await fs.readFile(privacySettingsPath, 'utf-8');

    assert.equal(
      content.includes('href="/terms"'),
      true,
      'Missing /terms link in PrivacySettings'
    );

    assert.equal(
      content.includes('href="/privacy"'),
      true,
      'Missing /privacy link in PrivacySettings'
    );

    assert.equal(
      content.includes("from '@/lib/cookiePreferences'"),
      true,
      'Missing shared cookie preference module import in PrivacySettings'
    );

    assert.equal(
      content.includes('const result = await reconcileCookiePreferences();'),
      true,
      'Missing shared reconciliation call in PrivacySettings'
    );

    assert.equal(
      content.includes('const saved = await saveCookiePreferences(preferences);'),
      true,
      'Missing shared save flow in PrivacySettings'
    );
  });

  await t.test('Shared cookie module should centralize profile fetch and preference save', async () => {
    const content = await fs.readFile(sharedModulePath, 'utf-8');

    assert.equal(
      content.includes('/api/v1/user/profile'),
      true,
      'Missing shared profile fetch logic'
    );

    assert.equal(
      content.includes('/api/v1/user/cookie-preferences'),
      true,
      'Missing shared cookie preference save logic'
    );
  });
});

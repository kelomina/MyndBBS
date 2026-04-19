import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('Settings Page - Privacy & Legal Options', async (t) => {
  const settingsPagePath = path.join(process.cwd(), 'src', 'app', 'u', 'settings', 'page.tsx');
  const privacySettingsPath = path.join(process.cwd(), 'src', 'components', 'PrivacySettings.tsx');

  await t.test('Settings page should have a privacy tab', async () => {
    const content = await fs.readFile(settingsPagePath, 'utf-8');
    assert.equal(
      content.includes('setActiveTab(\'privacy\')'),
      true,
      'Missing privacy tab button in settings page'
    );
    assert.equal(
      content.includes('<PrivacySettings />'),
      true,
      'Missing PrivacySettings component rendering'
    );
  });

  await t.test('PrivacySettings component should have legal links and preferences', async () => {
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
      content.includes('/api/v1/user/cookie-preferences'),
      true,
      'Missing cookie-preferences PUT API call'
    );
    
    assert.equal(
      content.includes('/api/v1/user/profile'),
      true,
      'Missing user profile fetch to load existing preferences'
    );
  });
});

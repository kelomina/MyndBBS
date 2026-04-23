import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('Legal Pages exist and have correct routing', async (t) => {
  const termsPagePath = path.join(process.cwd(), 'src', 'app', 'terms', 'page.tsx');
  const privacyPagePath = path.join(process.cwd(), 'src', 'app', 'privacy', 'page.tsx');
  const modalPath = path.join(process.cwd(), 'src', 'components', 'CookieConsentModal.tsx');
  const middlewarePath = path.join(process.cwd(), 'src', 'middleware.ts');

  await t.test('Terms page exists', async () => {
    const termsContent = await fs.readFile(termsPagePath, 'utf-8');
    assert.equal(termsContent.includes('TermsZh'), true, 'Missing TermsZh component import');
    assert.equal(termsContent.includes('TermsEn'), true, 'Missing TermsEn component import');
  });

  await t.test('Privacy page exists', async () => {
    const privacyContent = await fs.readFile(privacyPagePath, 'utf-8');
    assert.equal(privacyContent.includes('PrivacyZh'), true, 'Missing PrivacyZh component import');
    assert.equal(privacyContent.includes('PrivacyEn'), true, 'Missing PrivacyEn component import');
  });

  await t.test('Cookie Consent Modal has correct hrefs', async () => {
    const modalContent = await fs.readFile(modalPath, 'utf-8');
    assert.equal(modalContent.includes('href="/terms"'), true, 'Missing /terms link in modal');
    assert.equal(modalContent.includes('href="/privacy"'), true, 'Missing /privacy link in modal');
  });

  await t.test('Frontend middleware keeps legal pages public', async () => {
    const middlewareContent = await fs.readFile(middlewarePath, 'utf-8');
    assert.equal(middlewareContent.includes("'/terms'"), true, 'Missing /terms from essential public paths');
    assert.equal(middlewareContent.includes("'/privacy'"), true, 'Missing /privacy from essential public paths');
  });
});

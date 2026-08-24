import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('phase5: bio, drafts, hover card, PWA and API docs', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [profileSettings, profilePage, compose, hoverCard, swRegister, manifest, sw, docsPage, docsData, settingsPage, zhRaw, enRaw] =
    await Promise.all([
      read('src/components/ProfileSettings.tsx'),
      read(path.join('src', 'app', 'u', '[username]', 'page.tsx')),
      read('src/app/compose/ComposeForm.tsx'),
      read('src/components/UserHoverCard.tsx'),
      read('src/components/SWRegister.tsx'),
      read('src/app/manifest.ts'),
      fs.readFile(path.join(root, 'public', 'sw.js'), 'utf-8'),
      read('src/app/api-docs/page.tsx'),
      read('src/app/api-docs/openapi-data.ts'),
      read('src/app/u/settings/page.tsx'),
      fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'zh.json'), 'utf-8'),
      fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'en.json'), 'utf-8'),
    ]);
  const zh = JSON.parse(zhRaw);
  const en = JSON.parse(enRaw);

  await t.test('G15: bio editable in settings and rendered on the public profile', () => {
    assert.match(profileSettings, /\/api\/v1\/user\/bio/);
    assert.match(profileSettings, /maxLength=\{200\}/);
    assert.match(profilePage, /user\.bio === 'string' && user\.bio\.trim/);
  });

  await t.test('G17: draft autosave, restore banner and discard flow', () => {
    assert.match(compose, /\/api\/v1\/drafts\/post/);
    assert.match(compose, /draftRestore/);
    assert.match(compose, /draftDiscardAction/);
    assert.match(compose, /AUTOSAVE_INTERVAL_MS = 8000/);
    assert.match(compose, /void clearDraft\(\)/);
  });

  await t.test('G16: hover card wraps comment author links with badge/bio preview', () => {
    assert.match(hoverCard, /HOVER_OPEN_DELAY_MS = 300/);
    assert.match(hoverCard, /profileCache/);
    assert.match(hoverCard, /\/api\/v1\/user\/public\//);
    // CommentItem 接入
    return fs.readFile(path.join(root, 'src', 'app', 'p', '[id]', 'CommentItem.tsx'), 'utf-8').then((ci) => {
      assert.match(ci, /<UserHoverCard username=\{comment\.author\.username\}>/);
    });
  });

  await t.test('G18: PWA manifest, service worker and production registration', () => {
    assert.match(manifest, /short_name: 'MyndBBS'/);
    assert.match(manifest, /display: 'standalone'/);
    assert.match(swRegister, /process\.env\.NODE_ENV !== 'production'/);
    assert.match(sw, /addEventListener\('fetch'/);
  });

  await t.test('G19: API docs page groups core endpoints', () => {
    for (const group of ['Categories', 'Tags', 'Posts', 'Users', 'Reports', 'Drafts']) {
      assert.ok(docsData.includes(`group: '${group}'`), `missing group ${group}`);
    }
    assert.match(docsPage, /X-Requested-With/);
  });

  await t.test('dictionaries cover new strings in both locales', () => {
    assert.ok(zh.post.draftFound && en.post.draftFound);
    assert.ok(zh.userCard.joined && en.userCard.joined);
    assert.equal(zh.settings.bioLabel, '个人简介');
    assert.equal(en.settings.bioLabel, 'Bio');
  });
});

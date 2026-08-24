import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('phase3: tags, mentions and email notifications', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [compose, editForm, postPage, tagsPage, tagDetail, settingsPanel, emailAdmin, settingsPage] = await Promise.all([
    read('src/app/compose/ComposeForm.tsx'),
    read('src/app/p/[id]/edit/EditPostForm.tsx'),
    read('src/app/p/[id]/page.tsx'),
    read('src/app/tags/page.tsx'),
    read(path.join('src', 'app', 'tags', '[name]', 'page.tsx')),
    read('src/components/EmailNotificationsPanel.tsx'),
    read('src/app/admin/email/page.tsx'),
    read('src/app/u/settings/page.tsx'),
  ]);
  const zh = JSON.parse(await fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'zh.json'), 'utf-8'));
  const en = JSON.parse(await fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'en.json'), 'utf-8'));

  await t.test('composer and editor accept comma-separated tags', () => {
    assert.match(compose, /tagsInput/);
    assert.match(compose, /tags\.length \? \{ tags \} : \{\}/);
    assert.match(editForm, /initialPost\.tags \?\? \[\]\)\.join/);
    assert.match(editForm, /categoryId, tags \}/);
  });

  await t.test('post detail renders clickable tag chips', () => {
    assert.match(postPage, /href=\{`\/tags\/\$\{encodeURIComponent\(tag\)\}`\}/);
    assert.match(postPage, /# \{tag\}/);
  });

  await t.test('tags directory and per-tag pages exist (server-rendered)', () => {
    assert.match(tagsPage, /\/api\/tags/);
    assert.match(tagDetail, /\/api\/posts\?tag=/);
    assert.doesNotMatch(tagDetail, /onClick/); // RSC 不含事件处理器
  });

  await t.test('settings exposes email notification toggle panel', () => {
    assert.match(settingsPage, /EmailNotificationsPanel/);
    assert.match(settingsPage, /activeTab === 'notifications'/);
    assert.match(settingsPanel, /notification-preferences/);
    assert.match(settingsPanel, /emailNotificationsEnabled/);
  });

  await t.test('admin email page offers the NOTIFICATION template type', () => {
    assert.match(emailAdmin, /NOTIFICATION: \{ en: 'Notification \(reply\/mention\)'/);
  });

  await t.test('dictionaries cover tags, mention and email prefs', () => {
    assert.equal(zh.post.tagsLabel.includes('标签'), true);
    assert.equal(en.post.tagsLabel.includes('Tags'), true);
    assert.equal(zh.notifications.MENTION, '提到了你');
    assert.equal(en.notifications.MENTION, 'Mentioned You');
    assert.ok(zh.tags.title && en.tags.title);
    assert.ok(zh.settings.emailNotifications && en.settings.emailNotifications);
  });
});

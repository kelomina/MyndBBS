// Retained unchanged from federalCaptcha.ui.test.mjs; unrelated to verification migration.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('Notify badge sum: parallel unread-count + DM, 99+ cap, aria split, WS split, events, 30s poll, no inbox', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [navSrc, headerSrc, publicDictSrc] = await Promise.all([
    read('src/components/layout/UserNav.tsx'),
    read('src/components/layout/Header.tsx'),
    read('src/i18n/public-dictionary.ts'),
  ]);

  await t.test('parallel fetch DM + notify sum, no table mixing', () => {
    assert.match(navSrc, /\/api\/v1\/messages\/unread/);
    assert.match(navSrc, /\/api\/notifications\/unread-count/);
    assert.match(navSrc, /Promise\.all/);
    assert.match(navSrc, /dmUnread \+ notifyUnread|total = dmUnread/);
  });

  await t.test('99+ cap + aria-label split + tooltip', () => {
    assert.match(navSrc, /99\+/);
    assert.match(navSrc, /aria-label/);
    assert.match(navSrc, /badgeAriaTemplate/);
    assert.match(navSrc, /badgeTooltipTemplate/);
    assert.match(navSrc, /title=\{tooltip\}/);
  });

  await t.test('WS notification split + notifications-read event + 30s poll reuse', () => {
    assert.match(navSrc, /message\.type === 'notification'/);
    assert.match(navSrc, /new_message/);
    assert.match(navSrc, /fetchNotifyOnly/);
    assert.match(navSrc, /fetchDmOnly/);
    assert.match(navSrc, /notifications-read/);
    assert.match(navSrc, /notifications-received/);
    assert.match(navSrc, /setInterval\(fetchUnreadCount, 30000\)/);
  });

  await t.test('no inbox page introduced', async () => {
    const glob = await import('node:fs/promises').then((m) => m.default);
    // 收件箱页另立项：不得新增 /notifications 页面目录
    let hasNotificationsPage = false;
    try {
      await glob.access(path.join(root, 'src', 'app', 'notifications', 'page.tsx'));
      hasNotificationsPage = true;
    } catch {
      hasNotificationsPage = false;
    }
    assert.equal(hasNotificationsPage, false, 'notifications inbox page must not exist (separate project)');
  });

  await t.test('Header passes public badge templates, public dict picks badge keys', () => {
    assert.match(headerSrc, /badgeAriaTemplate/);
    assert.match(headerSrc, /badgeTooltipTemplate/);
    assert.match(publicDictSrc, /notifications:\s*pick\(dict\.notifications/);
    assert.match(publicDictSrc, /badgeAria/);
  });
});

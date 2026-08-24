import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('admin protection page: IP bans CRUD and anti-spam policy form', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [pageSrc, layoutSrc, apiSrc, zhRaw, enRaw] = await Promise.all([
    read('src/app/admin/protection/page.tsx'),
    read('src/app/admin/layout.tsx'),
    read('src/lib/api/admin.ts'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'zh.json'), 'utf-8'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'en.json'), 'utf-8'),
  ]);
  const zh = JSON.parse(zhRaw);
  const en = JSON.parse(enRaw);

  await t.test('page renders ban table and anti-spam policy form', () => {
    assert.match(pageSrc, /<Table>/);
    assert.match(pageSrc, /getIpBans\(\)/);
    assert.match(pageSrc, /createIpBan\(/);
    assert.match(pageSrc, /deleteIpBan\(id\)/);
    assert.match(pageSrc, /updateAntiSpamPolicy\(policy\)/);
    assert.match(pageSrc, /accountAgeDays/);
    assert.match(pageSrc, /cooldownMinutes/);
    assert.match(pageSrc, /maxNewContentsPerHour/);
  });

  await t.test('sidebar links the protection page for admins only', () => {
    assert.match(layoutSrc, /href="\/admin\/protection"/);
    const idxLayout = layoutContent(layoutSrc);
    assert.ok(idxLayout > -1);
  });

  function layoutContent(src) {
    return src.indexOf('isAdmin && (');
  }

  await t.test('admin API client exposes protection endpoints', () => {
    assert.match(apiSrc, /fetcher\('\/api\/admin\/protection\/ip-bans'/);
    assert.match(apiSrc, /fetcher\(`\/api\/admin\/protection\/ip-bans\/\$\{id\}`,\s*\{\s*method: 'DELETE'/s);
    assert.match(apiSrc, /fetcher\('\/api\/admin\/protection\/anti-spam'/);
    assert.match(apiSrc, /fetcher\('\/api\/admin\/protection\/anti-spam',\s*\{\s*method: 'PUT'/s);
  });

  await t.test('dictionaries include protection labels in both locales', () => {
    for (const key of ['protectionTitle', 'ipBanTitle', 'addIpBan', 'scopeAll', 'scopeRegistration']) {
      assert.ok(zh.admin?.[key], `zh admin.${key} missing`);
      assert.ok(en.admin?.[key], `en admin.${key} missing`);
    }
    for (const code of ['ERR_IP_BANNED', 'ERR_NEW_ACCOUNT_COOLDOWN', 'ERR_NEW_ACCOUNT_RATE_LIMITED']) {
      assert.ok(zh.apiErrors?.[code], `zh apiErrors.${code} missing`);
      assert.ok(en.apiErrors?.[code], `en apiErrors.${code} missing`);
    }
  });
});

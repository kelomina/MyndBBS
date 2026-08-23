import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('badge system: admin management, profile display and i18n', async (t) => {
  const pagePath = path.join(process.cwd(), 'src', 'app', 'admin', 'badges', 'page.tsx');
  const layoutPath = path.join(process.cwd(), 'src', 'app', 'admin', 'layout.tsx');
  const profilePath = path.join(process.cwd(), 'src', 'app', 'u', '[username]', 'page.tsx');
  const chipPath = path.join(process.cwd(), 'src', 'components', 'BadgeChip.tsx');
  const apiPath = path.join(process.cwd(), 'src', 'lib', 'api', 'admin.ts');
  const zhPath = path.join(process.cwd(), 'src', 'i18n', 'dictionaries', 'zh.json');
  const enPath = path.join(process.cwd(), 'src', 'i18n', 'dictionaries', 'en.json');

  const [pageContent, layoutContent, profileContent, chipContent, apiContent, zhRaw, enRaw] =
    await Promise.all([
      fs.readFile(pagePath, 'utf-8'),
      fs.readFile(layoutPath, 'utf-8'),
      fs.readFile(profilePath, 'utf-8'),
      fs.readFile(chipPath, 'utf-8'),
      fs.readFile(apiPath, 'utf-8'),
      fs.readFile(zhPath, 'utf-8'),
      fs.readFile(enPath, 'utf-8'),
    ]);
  const zh = JSON.parse(zhRaw);
  const en = JSON.parse(enRaw);

  await t.test('admin API client exposes badge CRUD, grant/revoke and evaluation calls', () => {
    assert.match(apiContent, /export const getBadges = /);
    assert.match(apiContent, /fetcher\('\/api\/admin\/badges',\s*\{\s*method: 'POST'/s);
    assert.match(apiContent, /fetcher\(`\/api\/admin\/badges\/\$\{id\}`,\s*\{\s*method: 'PUT'/s);
    assert.match(apiContent, /fetcher\(`\/api\/admin\/badges\/\$\{id\}`,\s*\{\s*method: 'DELETE'/s);
    assert.match(apiContent, /grantBadgeToUser/);
    assert.match(apiContent, /revokeBadgeFromUser/);
    assert.match(apiContent, /fetcher\(`\/api\/admin\/badges\/\$\{badgeId\}\/grants`,/s);
    assert.match(apiContent, /'\/api\/admin\/badges\/evaluate'/);
    assert.doesNotMatch(apiContent, /api\/v1\/user\/public[^']*badges/); // 不绕过 BFF
    assert.match(apiContent, /export const getBadgeHolders = /);
    assert.match(apiContent, /export const runBadgeEvaluation = /);
  });

  await t.test('admin badges page renders table, modals and role-gated controls', () => {
    assert.match(pageContent, /<Table>/);
    assert.match(pageContent, /<Modal\s+isOpen=\{formOpen\}/);
    assert.match(pageContent, /<Modal\s+isOpen=\{Boolean\(deletingBadge\)\}/);
    assert.match(pageContent, /<Modal\s+isOpen=\{Boolean\(grantingBadge\)\}/);
    assert.match(pageContent, /<Modal\s+isOpen=\{Boolean\(holdersBadge\)\}/);
    assert.match(pageContent, /const isAdmin = currentUser\?\.role === 'ADMIN' \|\| currentUser\?\.role === 'SUPER_ADMIN'/);
    assert.match(pageContent, /runBadgeEvaluation/);
    // SYSTEM 徽章的编辑与删除按钮被禁用
    assert.match(pageContent, /disabled=\{badge\.type === 'SYSTEM'\}/);
  });

  await t.test('admin sidebar links to the badges page for all staff roles', () => {
    assert.match(layoutContent, /href="\/admin\/badges"/);
    assert.match(layoutContent, /Award className="h-5 w-5"/);
  });

  await t.test('profile page shows a badge wall using BadgeChip', () => {
    assert.match(profileContent, /import \{ BadgeChip \} from '\.\.\/\.\.\/\.\.\/components\/BadgeChip'/);
    assert.match(profileContent, /dict\.profile\.badges \|\| 'Badges'/);
    assert.match(profileContent, /user\.badges && user\.badges\.length > 0/);
  });

  await t.test('BadgeChip maps palette colors and localizes built-in names', () => {
    assert.match(chipContent, /BADGE_COLORS/);
    assert.match(chipContent, /resolveBadgeName/);
    assert.match(chipContent, /dark:bg-gray-800 dark:text-gray-300/);
    const colorEntries = [...chipContent.matchAll(/^  (\w+): '/gm)].map((m) => m[1]);
    assert.ok(colorEntries.length >= 18, `expected >= 18 colors, got ${colorEntries.length}`);
  });

  await t.test('dictionaries expose built-in badge names/descriptions in both locales', () => {
    const builtinCodes = [
      'kolostudio_official',
      'level_1',
      'level_2',
      'level_3',
      'level_4',
      'level_5',
      'level_6',
      'anti_drug_guardian',
      'night_owl',
      'chatterbox',
    ];
    for (const code of builtinCodes) {
      assert.ok(zh.badges?.builtin?.[code]?.name, `zh missing badges.builtin.${code}.name`);
      assert.ok(en.badges?.builtin?.[code]?.name, `en missing badges.builtin.${code}.name`);
      assert.ok(zh.badges.builtin[code].desc, `zh missing badges.builtin.${code}.desc`);
      assert.ok(en.badges.builtin[code].desc, `en missing badges.builtin.${code}.desc`);
    }
    assert.equal(zh.badges.builtin.kolostudio_official.name, 'KoloStudio 官方');
    assert.equal(zh.badges.builtin.night_owl.name, '夜猫子');
    assert.equal(zh.badges.builtin.chatterbox.name, '话痨');
    assert.equal(zh.badges.builtin.anti_drug_guardian.name, '缉毒卫士');
    assert.equal(en.badges.builtin.kolostudio_official.name, 'KoloStudio Official');
    assert.equal(en.badges.builtin.night_owl.name, 'Night Owl');
  });

  await t.test('dictionaries include badge admin labels and error translations', () => {
    assert.equal(zh.admin.badgeManagement, '徽章管理');
    assert.equal(en.admin.badgeManagement, 'Badge Management');
    assert.equal(zh.admin.grantAction, '授予');
    assert.equal(en.admin.revokeBadge, 'Revoke');
    assert.equal(zh.profile.badges, '徽章');
    assert.equal(en.profile.badges, 'Badges');

    const errorCodes = [
      'ERR_BADGE_NOT_FOUND',
      'ERR_BADGE_CODE_ALREADY_EXISTS',
      'ERR_BADGE_SYSTEM_IMMUTABLE',
      'ERR_BADGE_CANNOT_DELETE_SYSTEM',
      'ERR_BADGE_ALREADY_OWNED',
      'ERR_BADGE_NOT_OWNED',
      'ERR_BADGE_INVALID_CONDITION',
      'ERR_BADGE_INACTIVE',
    ];
    for (const code of errorCodes) {
      assert.ok(zh.apiErrors[code], `zh apiErrors missing ${code}`);
      assert.ok(en.apiErrors[code], `en apiErrors missing ${code}`);
    }
  });

  await t.test('backend locale files stay in sync with frontend apiErrors keys', async () => {
    const backendZhPath = path.join(
      process.cwd(),
      '..',
      'backend',
      'src',
      'locales',
      'zh',
      'errors.json',
    );
    const backendEnPath = path.join(
      process.cwd(),
      '..',
      'backend',
      'src',
      'locales',
      'en',
      'errors.json',
    );
    const backendZh = JSON.parse(await fs.readFile(backendZhPath, 'utf-8'));
    const backendEn = JSON.parse(await fs.readFile(backendEnPath, 'utf-8'));
    assert.equal(backendZh.ERR_BADGE_NOT_FOUND, '徽章不存在');
    assert.equal(backendEn.ERR_BADGE_NOT_FOUND, 'Badge not found');
    assert.equal(backendZh.ERR_BADGE_ALREADY_OWNED, '用户已拥有该徽章');
    assert.equal(backendEn.ERR_BADGE_INACTIVE, 'Badge is currently inactive');
  });
});

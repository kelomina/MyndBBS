import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * 标签回归（零业务代码，只加回归测试）。
 * 冻结契约 API-SPEC-TAG-CAPTCHA-NOTIFY.yaml x-tag-regression：
 * 匿名 /tags/<name> 不在 /403，有 empty-state 或帖子卡其一；429 限流态渲染 ratelimit-card（与 empty-state 正交）。
 */
test('Tags regression: /tags wall + /tags/[name] render empty-state, rate-limit island orthogonal', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [wallSrc, detailSrc, zhRaw, enRaw] = await Promise.all([
    read('src/app/tags/page.tsx'),
    read('src/app/tags/[name]/page.tsx'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'zh.json'), 'utf-8'),
    fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'en.json'), 'utf-8'),
  ]);
  const zh = JSON.parse(zhRaw);
  const en = JSON.parse(enRaw);

  await t.test('/tags wall renders empty-state when no tags', () => {
    assert.match(wallSrc, /data-testid="empty-state"/);
    assert.match(wallSrc, /TagsRateLimitIsland/);
    assert.match(wallSrc, /initialRetryAfterSec/);
    // 空态与限流正交：wall 不得渲染 ratelimit-card 字面（经 Island 间接）
    assert.doesNotMatch(wallSrc, /data-testid="ratelimit-card"/);
  });

  await t.test('/tags/[name] renders empty-state or post cards, rate-limit via island', () => {
    assert.match(detailSrc, /data-testid="empty-state"/);
    assert.match(detailSrc, /PostListRateLimitIsland/);
    assert.match(detailSrc, /initialRetryAfterSec/);
    assert.match(detailSrc, /bffUrl/);
    assert.match(detailSrc, /\/api\/posts\?tag=/);
    assert.doesNotMatch(detailSrc, /data-testid="ratelimit-card"/);
  });

  await t.test('tags dict keys exist en/zh', () => {
    for (const k of ['title', 'subtitle', 'postCount', 'empty', 'backToTags', 'noPosts']) {
      assert.ok(zh.tags?.[k], `zh tags.${k} missing`);
      assert.ok(en.tags?.[k], `en tags.${k} missing`);
    }
  });

  await t.test('tags pages use serverFetch (RSC direct, no raw serverApiUrl fetch)', async () => {
    for (const src of [wallSrc, detailSrc]) {
      assert.match(src, /serverFetch/);
      assert.doesNotMatch(src, /fetch\(serverApiUrl\(/);
    }
  });
});

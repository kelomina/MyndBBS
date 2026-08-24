import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('report system: user reporting UI, moderation queue and i18n', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [postActions, commentItem, dialog, moderation, reportsApi, zhRaw, enRaw] =
    await Promise.all([
      read('src/app/p/[id]/PostActions.tsx'),
      read('src/app/p/[id]/CommentItem.tsx'),
      read('src/components/ReportDialog.tsx'),
      read('src/app/admin/moderation/ModerationClient.tsx'),
      read('src/lib/api/reports.ts'),
      fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'zh.json'), 'utf-8'),
      fs.readFile(path.join(root, 'src', 'i18n', 'dictionaries', 'en.json'), 'utf-8'),
    ]);
  const zh = JSON.parse(zhRaw);
  const en = JSON.parse(enRaw);

  await t.test('posts and comments expose a report entry hidden from own content', () => {
    assert.match(postActions, /<ReportDialog/);
    assert.match(postActions, /const isOwnPost = currentUser && currentUser\.username === authorUsername/);
    assert.match(commentItem, /currentUser\.username !== comment\.author\?\.username/);
    assert.match(commentItem, /<ReportDialog/);
  });

  await t.test('report dialog submits via the API with reason and detail', () => {
    assert.match(dialog, /REPORT_REASONS/);
    assert.match(dialog, /submitReport\(\{/);
    assert.match(dialog, /reason === 'OTHER' \&\& /);
  });

  await t.test('moderation queue has a user-reports tab with uphold/dismiss actions', () => {
    assert.match(moderation, /type Tab = 'posts' \| 'comments' \| 'words' \| 'reports'/);
    assert.match(moderation, /\/api\/admin\/reports\?status=/);
    assert.match(moderation, /\/api\/admin\/reports\/\$\{id\}\/resolve/);
    assert.match(moderation, /\/api\/admin\/reports\/\$\{id\}\/dismiss/);
  });

  await t.test('client API posts to the BFF-relative reports endpoint', () => {
    assert.match(reportsApi, /fetcher\('\/api\/v1\/reports'/);
    assert.doesNotMatch(reportsApi, /localhost|127\.0\.0\.1/);
  });

  await t.test('dictionaries cover report flow in both locales', () => {
    for (const key of ['postTitle', 'commentTitle', 'submitted', 'failed', 'notice']) {
      assert.ok(zh.report?.[key], `zh report.${key} missing`);
      assert.ok(en.report?.[key], `en report.${key} missing`);
    }
    for (const code of ['SPAM', 'PORNOGRAPHY', 'ILLEGAL', 'ABUSE', 'COPYRIGHT', 'OTHER']) {
      assert.ok(zh.report.reasons[code], `zh report.reasons.${code} missing`);
      assert.ok(en.report.reasons[code], `en report.reasons.${code} missing`);
    }
    for (const key of ['userReports', 'report_PENDING', 'report_RESOLVED', 'report_DISMISSED']) {
      assert.ok(zh.admin?.[key], `zh admin.${key} missing`);
      assert.ok(en.admin?.[key], `en admin.${key} missing`);
    }
  });
});

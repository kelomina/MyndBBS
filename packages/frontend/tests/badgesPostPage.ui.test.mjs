import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('post page surfaces author badges (full chips for author, compact for comments)', async (t) => {
  const root = process.cwd();
  const read = (p) => fs.readFile(path.join(root, p), 'utf-8');
  const [pageSrc, commentItemSrc, commentsSectionSrc, typesSrc, chipSrc, backendDto, backendQuery] =
    await Promise.all([
      read('src/app/p/[id]/page.tsx'),
      read('src/app/p/[id]/CommentItem.tsx'),
      read('src/app/p/[id]/CommentsSection.tsx'),
      read('src/types/posts.ts'),
      read('src/components/BadgeChip.tsx'),
      read(path.join('..', 'backend', 'src', 'queries', 'community', 'dto.ts')),
      read(path.join('..', 'backend', 'src', 'queries', 'community', 'CommunityQueryService.ts')),
    ]);

  await t.test('post detail page renders full badge chips for the post author', () => {
    assert.match(pageSrc, /import \{ BadgeChip \} from "\.\.\/\.\.\/\.\.\/components\/BadgeChip"/);
    assert.match(pageSrc, /post\.author\?\.badges/);
    assert.match(pageSrc, /<BadgeChip key=\{badge\.id\} badge=\{badge\} dict=\{dict\} \/>/);
    assert.doesNotMatch(pageSrc, /BadgeChip[^/\n]*compact/); // 作者区不用紧凑模式
  });

  await t.test('comment item links username to profile and renders compact badges', () => {
    assert.match(commentItemSrc, /href=\{`\/u\/\$\{encodeURIComponent\(comment\.author\.username\)\}`\}/);
    assert.match(commentItemSrc, /<BadgeChip key=\{badge\.id\} badge=\{badge\} dict=\{dict\} compact \/>/);
    assert.match(commentItemSrc, /comment\.author\?\.badges/);
  });

  await t.test('all reply preview rows render compact badges', () => {
    const occurrences = commentsSectionSrc.split('<BadgeChip key={b.id} badge={b} dict={dict} compact />').length - 1;
    assert.ok(occurrences >= 4, `expected >=4 preview badge renders, got ${occurrences}`);
    assert.match(commentsSectionSrc, /child\.author\.badges\.map/);
  });

  await t.test('types expose badges on comment authors and BadgeChip supports compact mode', () => {
    assert.match(typesSrc, /CommentAuthor = \{ username\?: string \| null; avatarUrl\?: string \| null; badges\?: ProfileBadge\[\] \}/);
    assert.match(chipSrc, /compact\?: boolean/);
    assert.match(chipSrc, /const title = tip \? `\$\{label\} · \$\{tip\}` : label/);
  });

  await t.test('backend DTO and queries include active author badges', () => {
    assert.match(backendDto, /export type AuthorBadgeDTO = \{/);
    assert.match(backendDto, /badges: AuthorBadgeDTO\[\]/);
    assert.match(backendQuery, /AUTHOR_SUMMARY_SELECT/);
    assert.match(backendQuery, /badge: \{ isActive: true \}/);
    assert.match(backendQuery, /sortOrder: 'asc'/);
  });
});

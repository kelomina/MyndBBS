import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('CommentsSection keeps new comments and reply previews in local state', async (t) => {
  const pagePath = path.join(process.cwd(), 'src', 'app', 'p', '[id]', 'CommentsSection.tsx');
  const pageContent = await fs.readFile(pagePath, 'utf-8');

  await t.test('created comments are inserted locally without forcing a router refresh', () => {
    assert.match(pageContent, /appendCreatedComment\(createdComment, replyTo\?\.id \?\? null\)/);
    assert.doesNotMatch(pageContent, /router\.refresh\(\)/);
  });

  await t.test('root comments prefetch initial reply previews', () => {
    assert.match(pageContent, /const fetchPreviewReplies = useCallback/);
    assert.match(pageContent, /parentId=\$\{comment\.id\}&skip=0&take=\$\{PREVIEW_COUNT\}/);
    assert.match(pageContent, /previewReplies: previewsById\.get\(comment\.id\) \?\? comment\.previewReplies/);
  });

  await t.test('collapsed replies render preview comments before expansion', () => {
    assert.match(pageContent, /node\.previewReplies/);
    assert.match(pageContent, /previewChildren\.map/);
    assert.match(pageContent, /previewComments\.map/);
  });
});

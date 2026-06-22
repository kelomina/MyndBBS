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
    assert.match(pageContent, /const PREVIEW_FETCH_COUNT = PREVIEW_COUNT \* 3/);
    assert.match(pageContent, /parentId=\$\{comment\.id\}&skip=0&take=\$\{PREVIEW_FETCH_COUNT\}/);
    assert.match(pageContent, /previewReplies: toVisiblePreviewComments\(previewsById\.get\(comment\.id\) \?\? comment\.previewReplies \?\? \[\]\)/);
  });

  await t.test('collapsed replies render preview comments before expansion', () => {
    assert.match(pageContent, /node\.previewReplies/);
    assert.match(pageContent, /previewChildren\.map/);
    assert.match(pageContent, /previewComments\.map/);
  });

  await t.test('deleted comments stay in full state but are removed from previews', () => {
    assert.match(pageContent, /const toVisiblePreviewComments = \(comments: PostComment\[\]\) =>/);
    assert.match(pageContent, /comments\.filter\(comment => comment\.deletedAt == null\)\.slice\(0, PREVIEW_COUNT\)/);
    assert.match(pageContent, /const markDeletedComment = \(comment: PostComment, commentId: string, deletedAt: string\): PostComment =>/);
    assert.match(pageContent, /comments: markDeletedComments\(state\.comments, commentId, deletedAt\)/);
    assert.match(pageContent, /previewComments: markDeletedPreviewComments\(state\.previewComments, commentId, deletedAt\)/);
    assert.match(pageContent, /toVisiblePreviewComments\(storedPreviewComments \?\? node\.previewReplies \?\? \[\]\)/);
    assert.match(pageContent, /toVisiblePreviewComments\(storedPreviewChildren \?\? node\.previewReplies \?\? \[\]\)/);
  });
});

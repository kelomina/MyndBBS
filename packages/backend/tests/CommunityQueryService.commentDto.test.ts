import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('CommunityQueryService comment DTO shape', () => {
  it('returns count and moderation fields for a freshly created comment lookup', async () => {
    const queryPath = path.join(process.cwd(), 'src', 'queries', 'community', 'CommunityQueryService.ts');
    const source = await fs.readFile(queryPath, 'utf-8');

    const getCommentByIdStart = source.indexOf('public async getCommentById');
    assert.ok(getCommentByIdStart >= 0, 'getCommentById should exist');

    const getCommentByIdSource = source.slice(getCommentByIdStart);
    assert.ok(getCommentByIdSource.includes('_count: { select: { upvotes: true, bookmarks: true, replies: true } }'));
    assert.ok(getCommentByIdSource.includes('deletedAt: comment.deletedAt'));
    assert.ok(getCommentByIdSource.includes('isPending: comment.isPending'));
    assert.ok(getCommentByIdSource.includes('hasUpvoted: false'));
    assert.ok(getCommentByIdSource.includes('hasBookmarked: false'));
  });
});

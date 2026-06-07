import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('Friends page supports removing friends and blocking users', async (t) => {
  const pagePath = path.join(process.cwd(), 'src', 'app', 'friends', 'page.tsx');
  const content = await fs.readFile(pagePath, 'utf-8');

  await t.test('Page should include handleRemoveFriend logic', () => {
    assert.equal(
      content.includes('const handleRemoveFriend = async'),
      true,
      'Missing handleRemoveFriend function'
    );
    assert.equal(
      content.includes('/api/v1/friends/remove'),
      true,
      'Missing API call for removing friend'
    );
  });

  await t.test('Page should include handleBlockUser logic', () => {
    assert.equal(
      content.includes('const handleBlockUser = async'),
      true,
      'Missing handleBlockUser function'
    );
    assert.equal(
      content.includes('/api/v1/friends/block'),
      true,
      'Missing API call for blocking user'
    );
  });

  await t.test('Page should render Blacklist section if blockedList is not empty', () => {
    assert.equal(
      content.includes('blockedList.length > 0'),
      true,
      'Missing blockedList rendering logic'
    );
  });
});

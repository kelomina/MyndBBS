import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('Friends page splits pending requests and accepted friends', async (t) => {
  const pagePath = path.join(process.cwd(), 'src', 'app', 'friends', 'page.tsx');
  const content = await fs.readFile(pagePath, 'utf-8');

  await t.test('Page should compute pendingRequests separately', () => {
    assert.equal(
      content.includes('const pendingRequests = friendships.filter('),
      true,
      'Missing pendingRequests filter logic'
    );
  });

  await t.test('Page should compute friendsList separately', () => {
    assert.equal(
      content.includes('const friendsList = friendships.filter('),
      true,
      'Missing friendsList filter logic'
    );
  });

  await t.test('Page should have collapsible button for pending requests', () => {
    assert.equal(
      content.includes('onClick={() => setShowRequests(!showRequests)}'),
      true,
      'Missing collapsible button onClick handler'
    );
  });
});

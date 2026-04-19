import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('Frontend UI dispatches messages-read event after reading messages and responding to friends', async (t) => {
  const messagesPagePath = path.join(process.cwd(), 'src', 'app', 'messages', '[username]', 'page.tsx');
  const friendsPagePath = path.join(process.cwd(), 'src', 'app', 'friends', 'page.tsx');
  
  const messagesContent = await fs.readFile(messagesPagePath, 'utf-8');
  const friendsContent = await fs.readFile(friendsPagePath, 'utf-8');

  await t.test('messages/[username]/page.tsx should contain dispatchEvent after markAsRead fetch', () => {
    assert.equal(
      messagesContent.includes("window.dispatchEvent(new Event('messages-read'))"), 
      true, 
      'messages/[username]/page.tsx is missing dispatchEvent logic'
    );
  });

  await t.test('friends/page.tsx should contain dispatchEvent after friend request respond', () => {
    assert.equal(
      friendsContent.includes("window.dispatchEvent(new Event('messages-read'))"), 
      true, 
      'friends/page.tsx is missing dispatchEvent logic'
    );
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('messages page includes CSRF token in fetch calls', async (t) => {
  const pagePath = path.join(process.cwd(), 'src', 'app', 'messages', 'page.tsx');
  const pageContent = await fs.readFile(pagePath, 'utf-8');

  await t.test('fetch calls in handleInitSecureMessaging should include X-Requested-With header', () => {
    const usesAuthenticatedFetcher = pageContent.includes("fetchWithAuth('/api/v1/messages/keys'");
    assert.equal(usesAuthenticatedFetcher, true, 'Secure messaging upload should use fetchWithAuth so the CSRF header is present');
  });
});

test('open chat syncs to server message list and supports read-started expiry', async (t) => {
  const pagePath = path.join(process.cwd(), 'src', 'app', 'messages', '[username]', 'page.tsx');
  const pageContent = await fs.readFile(pagePath, 'utf-8');

  await t.test('polling replaces local messages with the server list instead of appending only', () => {
    assert.match(pageContent, /const plaintextById = new Map\(prev\.map\(m => \[m\.id, m\.plaintext\]\)\)/);
    assert.match(pageContent, /return serverMessages\.map\(msg => \(\{/);
  });

  await t.test('markAsRead refreshes the conversation so expiresAt from the server is visible', () => {
    assert.match(pageContent, /window\.dispatchEvent\(new Event\('messages-read'\)\)/);
    assert.match(pageContent, /void refreshConversationRef\.current\(\)/);
  });

  await t.test('receiver-side timed messages are removed in the open conversation at expiresAt', () => {
    assert.match(pageContent, /receiverExpiryTimes/);
    assert.match(pageContent, /setMessages\(prev =>\s+prev\.filter/);
    assert.match(pageContent, /window\.setTimeout\(removeExpiredReceiverMessages/);
  });

  await t.test('image messages carry the same timed and auto-delete options as text messages', () => {
    assert.match(pageContent, /isTimedMessage: timedMessageEnabled/);
    assert.match(pageContent, /autoDeleteForSelf/);
    assert.match(pageContent, /expiresIn: timedMessageEnabled && expiresIn > 0 \? expiresIn : undefined/);
  });
});

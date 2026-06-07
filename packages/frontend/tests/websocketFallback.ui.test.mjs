import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';

test('useWebSocket does not synthesize notification events during reconnect fallback', async () => {
  const hookPath = path.join(process.cwd(), 'src', 'lib', 'hooks', 'useWebSocket.ts');
  const content = await fs.readFile(hookPath, 'utf-8');

  assert.equal(content.includes("type: 'notification'"), false);
  assert.equal(content.includes("source: 'polling'"), false);
});

test('messages page and user nav own their disconnected polling intervals', async () => {
  const messagesPath = path.join(process.cwd(), 'src', 'app', 'messages', 'page.tsx');
  const userNavPath = path.join(process.cwd(), 'src', 'components', 'layout', 'UserNav.tsx');
  const [messagesContent, userNavContent] = await Promise.all([
    fs.readFile(messagesPath, 'utf-8'),
    fs.readFile(userNavPath, 'utf-8'),
  ]);

  assert.match(messagesContent, /if \(!hasKey \|\| connected\) return/);
  assert.match(userNavContent, /connected \? null : setInterval/);
});

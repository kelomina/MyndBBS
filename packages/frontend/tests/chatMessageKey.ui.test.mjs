import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('ChatPage frontend updates state correctly and avoids React key warnings', async (t) => {
  const pagePath = path.join(process.cwd(), 'src', 'app', 'messages', '[username]', 'page.tsx');
  const content = await fs.readFile(pagePath, 'utf-8');

  await t.test('handleSend should generate fallback ID when data.message is undefined', () => {
    assert.equal(
      content.includes('id: data.messageId || `temp-${Date.now()}`'),
      true,
      'Missing ID generation fallback logic for text messages'
    );
  });

  await t.test('handleImageUpload should generate fallback ID when data.message is undefined', () => {
    assert.equal(
      content.match(/id: data\.messageId \|\| `temp-\$\{Date\.now\(\)\}`/g)?.length >= 2,
      true,
      'Missing ID generation fallback logic for image messages'
    );
  });
});

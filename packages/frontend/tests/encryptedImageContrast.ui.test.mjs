import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('EncryptedImage context menu has proper text contrast classes', async (t) => {
  const pagePath = path.join(process.cwd(), 'src', 'app', 'messages', '[username]', 'page.tsx');
  const content = await fs.readFile(pagePath, 'utf-8');

  await t.test('Menu container should include text-foreground class', () => {
    assert.equal(
      content.includes('bg-background text-foreground'),
      true,
      'Missing text-foreground in context menu container'
    );
  });

  await t.test('Menu buttons should include hover:text-accent-foreground class', () => {
    assert.equal(
      content.includes('hover:text-accent-foreground'),
      true,
      'Missing hover text contrast class on context menu buttons'
    );
  });
});

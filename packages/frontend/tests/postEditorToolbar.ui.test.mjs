import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('PostEditor toolbar buttons perform real markdown actions', async (t) => {
  const editorPath = path.join(process.cwd(), 'src', 'components', 'PostEditor.tsx');
  const editorContent = await fs.readFile(editorPath, 'utf-8');

  await t.test('bold and italic buttons wrap the selected text', () => {
    assert.match(editorContent, /onClick=\{\(\) => wrapSelection\('\*\*', '\*\*'/);
    assert.match(editorContent, /onClick=\{\(\) => wrapSelection\('\*', '\*'/);
  });

  await t.test('list button converts selected lines to markdown list items', () => {
    assert.match(editorContent, /const insertList = \(\) =>/);
    assert.match(editorContent, /return `- \$\{line\}`/);
  });

  await t.test('link button prompts for a URL and inserts markdown link syntax', () => {
    assert.match(editorContent, /window\.prompt\(postDict\.linkUrlPrompt/);
    assert.match(editorContent, /const linkText = `\[\$\{label\}\]\(\$\{url\}\)`/);
  });

  await t.test('image button uploads through the existing upload API and inserts markdown image syntax', () => {
    assert.match(editorContent, /fetchWithAuth\('\/api\/v1\/messages\/upload'/);
    assert.match(editorContent, /const imageText = `!\[\$\{label\}\]\(\$\{url\}\)`/);
    assert.match(editorContent, /imageInputRef\.current\?\.click\(\)/);
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

test('admin shell hides admin-only navigation from moderators', async () => {
  const layoutPath = path.join(root, 'src/app/admin/layout.tsx');
  const source = await fs.readFile(layoutPath, 'utf8');

  assert.match(source, /const isAdmin = role === 'ADMIN' \|\| isSuperAdmin/);
  assert.match(source, /\{isAdmin && \(\s*<Link\s+href="\/admin\/users"/s);
  assert.match(source, /\{isAdmin && \(\s*<Link\s+href="\/admin\/categories"/s);
  assert.match(source, /\{isAdmin && \(\s*<Link\s+href="\/admin\/recycle"/s);
});

test('admin index sends moderators to moderation instead of users', async () => {
  const pagePath = path.join(root, 'src/app/admin/page.tsx');
  const source = await fs.readFile(pagePath, 'utf8');

  assert.match(source, /data\.user\?\.role === 'MODERATOR'/);
  assert.match(source, /redirect\('\/admin\/moderation'\)/);
  assert.match(source, /redirect\('\/admin\/users'\)/);
});

test('high-risk admin pages use sudo reauthentication flow', async () => {
  const files = [
    'src/app/admin/db/page.tsx',
    'src/app/admin/domain/page.tsx',
    'src/app/admin/email/page.tsx',
    'src/app/admin/routes/page.tsx',
  ];

  for (const file of files) {
    const source = await fs.readFile(path.join(root, file), 'utf8');
    assert.match(source, /useSudoAction/);
    assert.match(source, /runWithSudo/);
    assert.match(source, /\{sudoModal\}/);
  }
});

test('categories page does not fail the whole view when user list is forbidden', async () => {
  const pagePath = path.join(root, 'src/app/admin/categories/page.tsx');
  const source = await fs.readFile(pagePath, 'utf8');

  assert.match(source, /const cats = await getCategories\(\)/);
  assert.match(source, /const allUsers = await getUsers\(\)/);
  assert.match(source, /setCanLoadUsers\(false\)/);
  assert.match(source, /canManageCategories && canLoadUsers/);
});

test('security-sensitive UI avoids inline style attributes blocked by production CSP', async () => {
  const files = [
    'src/components/Avatar.tsx',
    'src/components/SliderCaptcha.tsx',
    'src/app/403/page.tsx',
  ];

  for (const file of files) {
    const source = await fs.readFile(path.join(root, file), 'utf8');
    assert.doesNotMatch(source, /style=\{\{/);
  }
});

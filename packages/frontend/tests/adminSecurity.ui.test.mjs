import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const root = process.cwd();

test('admin shell hides admin-only navigation from moderators', async () => {
  const layoutPath = path.join(root, 'src/app/admin/layout.tsx');
  const source = await fs.readFile(layoutPath, 'utf8');

  assert.match(source, /const isAdmin = role === 'ADMIN' \|\| isSuperAdmin/);
  assert.match(source, /\{isAdmin && \(\s*<Link\s+href="\/admin\/users"/s);
  assert.match(source, /\{isAdmin && \(\s*<Link\s+href="\/admin\/categories"/s);
  assert.match(source, /\{isAdmin && \(\s*<Link\s+href="\/admin\/recycle"/s);
});

test('admin index keeps moderation redirects and restricts the plugin dashboard to admins', async () => {
  const source = await fs.readFile(path.join(root, 'src/app/admin/page.tsx'), 'utf8');
  let role = 'USER';
  let authenticated = true;
  const PluginDashboard = () => null;
  const stubs = {
    'next/headers': { cookies: async () => ({ getAll: () => [] }) },
    'next/navigation': { redirect: (target) => { throw new Error('redirect:' + target); } },
    '../../components/plugins/PluginDashboard': { PluginDashboard },
    '../../lib/bff/serverApi': { serverFetch: async (target) => {
      assert.equal(target, '/api/v1/user/profile');
      return { ok: authenticated, json: async () => ({ user: { role } }) };
    } },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
  };
  const evaluatedModule = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(output, { module: evaluatedModule, exports: evaluatedModule.exports, require: (name) => {
    assert.ok(Object.hasOwn(stubs, name), 'Unexpected page dependency: ' + name);
    return stubs[name];
  } });
  const page = evaluatedModule.exports.default;
  role = 'MODERATOR';
  await assert.rejects(page, /^Error: redirect:\/admin\/moderation$/);
  for (const allowed of ['ADMIN', 'SUPER_ADMIN']) {
    role = allowed;
    assert.equal((await page()).type, PluginDashboard);
  }
  role = 'USER';
  await assert.rejects(page, /^Error: redirect:\/$/);
  authenticated = false;
  await assert.rejects(page, /^Error: redirect:\/login$/);
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
    'src/components/human-verification/HumanVerification.tsx',
    'src/app/403/page.tsx',
  ];

  for (const file of files) {
    const source = await fs.readFile(path.join(root, file), 'utf8');
    assert.doesNotMatch(source, /style=\{\{/);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('admin users page exposes anonymized delete flow', async (t) => {
  const pagePath = path.join(process.cwd(), 'src', 'app', 'admin', 'users', 'page.tsx');
  const apiPath = path.join(process.cwd(), 'src', 'lib', 'api', 'admin.ts');
  const zhPath = path.join(process.cwd(), 'src', 'i18n', 'dictionaries', 'zh.json');
  const enPath = path.join(process.cwd(), 'src', 'i18n', 'dictionaries', 'en.json');

  const pageContent = await fs.readFile(pagePath, 'utf-8');
  const apiContent = await fs.readFile(apiPath, 'utf-8');
  const zh = JSON.parse(await fs.readFile(zhPath, 'utf-8'));
  const en = JSON.parse(await fs.readFile(enPath, 'utf-8'));

  await t.test('admin API client should call DELETE /api/admin/users/:id', () => {
    assert.match(apiContent, /export const deleteUser = \(id: string\) =>/);
    assert.match(apiContent, /fetcher\(`\/api\/admin\/users\/\$\{id\}`,\s*\{\s*method: 'DELETE'/s);
  });

  await t.test('admin API client should call POST /api/admin/users/test-account', () => {
    assert.match(apiContent, /export const createTestAccount = \(payload: CreateTestAccountPayload\)/);
    assert.match(apiContent, /fetcher\('\/api\/admin\/users\/test-account',\s*\{\s*method: 'POST'/s);
  });

  await t.test('page should show a delete action and confirmation modal', () => {
    assert.match(pageContent, /import \{ AlertTriangle, FlaskConical, Trash2 \} from 'lucide-react'/);
    assert.match(pageContent, /onClick=\{\(\) => setDeletingUser\(user\)\}/);
    assert.match(pageContent, /<Modal\s+isOpen=\{Boolean\(deletingUser\)\}/);
    assert.match(pageContent, /confirmDeleteUserTitle/);
    assert.match(pageContent, /confirmDeleteUser/);
  });

  await t.test('confirmed deletion should refresh the list and translate failures', () => {
    assert.match(pageContent, /await deleteUser\(deletingUser\.id\)/);
    assert.match(pageContent, /toast\(dict\.admin\?\.userDeleted \|\| 'User deleted', 'success'\)/);
    assert.match(pageContent, /await loadUsers\(searchQuery\)/);
    assert.match(pageContent, /\(dict\.apiErrors as Record<string, string>\)\?\.\[msg\]/);
    assert.match(pageContent, /failedToDeleteUser/);
  });

  await t.test('deleted users should be visibly inert in the table', () => {
    assert.match(pageContent, /INACTIVE: 'INACTIVE'/);
    assert.match(pageContent, /disabled=\{user\.status === USER_STATUS\.INACTIVE\}/);
    assert.match(pageContent, /deletedUser/);
  });

  await t.test('super admins can open the test account creation modal', () => {
    assert.match(pageContent, /useCurrentUser\(\)/);
    assert.match(pageContent, /const isSuperAdmin = currentUser\?\.role === 'SUPER_ADMIN'/);
    assert.match(pageContent, /createTestAccount\(testAccountForm\)/);
    assert.match(pageContent, /<Modal\s+isOpen=\{testAccountModalOpen\}/);
    assert.match(pageContent, /test-account-username/);
    assert.match(pageContent, /test-account-email/);
    assert.match(pageContent, /test-account-password/);
    assert.match(pageContent, /testAccountCreatedHint/);
  });

  await t.test('dictionaries should include delete labels and error translations', () => {
    assert.equal(zh.admin.deleteUser, '删除用户');
    assert.equal(en.admin.deleteUser, 'Delete user');
    assert.equal(zh.admin.userDeleted, '用户已删除');
    assert.equal(en.admin.userDeleted, 'User deleted');
    assert.equal(zh.apiErrors.ERR_FORBIDDEN_CANNOT_DELETE_SELF, '不能删除当前登录的账号');
    assert.equal(en.apiErrors.ERR_FORBIDDEN_CANNOT_DELETE_SELF, 'You cannot delete the account you are currently using');
    assert.equal(zh.apiErrors.ERR_ACCOUNT_NOT_ACTIVE, '账号已被删除或未激活');
    assert.equal(en.apiErrors.ERR_ACCOUNT_NOT_ACTIVE, 'Account has been deleted or is not active');
  });

  await t.test('dictionaries should include test account labels and error translations', () => {
    assert.equal(zh.admin.createTestAccount, '创建测试账号');
    assert.equal(en.admin.createTestAccount, 'Create test account');
    assert.equal(zh.admin.testAccountCreated, '测试账号已创建');
    assert.equal(en.admin.testAccountCreated, 'Test account created');
    assert.equal(zh.apiErrors.ERR_TEST_ACCOUNT_USERNAME_MUST_START_WITH_TEST_PREFIX, '测试账号用户名必须以 test_ 开头，只能包含字母、数字、下划线和连字符');
    assert.equal(en.apiErrors.ERR_TEST_ACCOUNT_USERNAME_MUST_START_WITH_TEST_PREFIX, 'Test account usernames must start with test_ and only contain letters, numbers, underscores, and hyphens');
  });
});

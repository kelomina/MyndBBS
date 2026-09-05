import fs from 'fs';
import path from 'path';

describe('admin route security wiring', () => {
  const raw = fs.readFileSync(path.join(__dirname, '../src/routes/admin.ts'), 'utf8');
  // Prettier 可能将长路由折为多行；去除全部空白后断言（仍校验 requireSudo 接线存在）
  const source = raw.replace(/\s+/g, '');

  it('requires sudo for high-risk configuration mutations', () => {
    const routes = [
      "router.post('/users/test-account', requireAbility('manage', 'all'), requireSudo",
      "router.patch('/users/:id/role', requireAbility('manage', 'User'), requireSudo",
      "router.patch('/users/:id/status', requireAbility('manage', 'User'), requireSudo",
      "router.delete('/users/:id', requireAbility('manage', 'User'), requireSudo",
      "router.post('/categories', requireAbility('manage', 'Category'), requireSudo",
      "router.put('/categories/:id', requireAbility('manage', 'Category'), requireSudo",
      "router.delete('/categories/:id', requireAbility('manage', 'Category'), requireSudo",
      "router.post('/categories/:categoryId/moderators/:userId', requireAbility('manage', 'Category'), requireSudo",
      "router.delete('/categories/:categoryId/moderators/:userId', requireAbility('manage', 'Category'), requireSudo",
      "router.post('/recycle/posts/:id/restore', requireAbility('manage', 'AdminPanel'), requireSudo",
      "router.delete('/recycle/posts/:id', requireAbility('manage', 'AdminPanel'), requireSudo",
      "router.post('/recycle/comments/:id/restore', requireAbility('manage', 'AdminPanel'), requireSudo",
      "router.delete('/recycle/comments/:id', requireAbility('manage', 'AdminPanel'), requireSudo",
      "router.post('/db-config', requireAbility('manage', 'all'), requireSudo",
      "router.post('/domain-config', requireAbility('manage', 'all'), requireSudo",
      "router.post('/email-config', requireAbility('manage', 'all'), requireSudo",
      "router.put('/email-config/templates/:type', requireAbility('manage', 'all'), requireSudo",
      "router.post('/email-config/test', requireAbility('manage', 'all'), requireSudo",
      "router.post('/routing-whitelist', requireAbility('manage', 'AdminPanel'), requireSudo",
      "router.put('/routing-whitelist/:id', requireAbility('manage', 'AdminPanel'), requireSudo",
      "router.delete('/routing-whitelist/:id', requireAbility('manage', 'AdminPanel'), requireSudo",
    ];

    for (const route of routes) {
      expect(source).toContain(route.replace(/\s+/g, ''));
    }
  });

  it('restricts the full route whitelist admin view to manage all', () => {
    expect(source).toContain(
      "router.get('/routing-whitelist',requireAbility('manage','all'),getRouteWhitelist)".replace(/\s+/g, ''),
    );
  });
});

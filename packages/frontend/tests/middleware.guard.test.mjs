import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';

test('returns /403 when userRoleLevel is lower than requiredRoleLevel', async () => {
  const { getAccessRedirectPath } = await import(`../src/lib/routingGuard.ts?cacheBust=${Date.now()}`);
  assert.equal(getAccessRedirectPath(1, 0), '/403');
  assert.equal(getAccessRedirectPath(3, 1), '/403');
});

test('returns null when route is public or user meets required role', async () => {
  const { getAccessRedirectPath } = await import(`../src/lib/routingGuard.ts?cacheBust=${Date.now()}`);
  assert.equal(getAccessRedirectPath(0, 0), null);
  assert.equal(getAccessRedirectPath(2, 2), null);
});

test('sortWhitelist sorts exact matches before prefixes, and longest prefixes first', async () => {
  const { sortWhitelist } = await import(`../src/lib/routingGuard.ts?cacheBust=${Date.now()}`);
  const routes = [
    { path: '/admin', isPrefix: true },
    { path: '/admin/users', isPrefix: false },
    { path: '/admin/settings', isPrefix: true },
    { path: '/', isPrefix: true },
  ];
  
  const sorted = sortWhitelist(routes);
  assert.equal(sorted[0].path, '/admin/users'); // exact match
  assert.equal(sorted[1].path, '/admin/settings'); // prefix, length 15
  assert.equal(sorted[2].path, '/admin'); // prefix, length 6
  assert.equal(sorted[3].path, '/'); // prefix, length 1
});

test('matchRoute finds the correct route', async () => {
  const { matchRoute } = await import(`../src/lib/routingGuard.ts?cacheBust=${Date.now()}`);
  const routes = [
    { path: '/admin/users', isPrefix: false },
    { path: '/admin/settings', isPrefix: true },
    { path: '/admin', isPrefix: true },
    { path: '/', isPrefix: true },
  ];
  
  assert.equal(matchRoute('/admin/users', routes).path, '/admin/users');
  assert.equal(matchRoute('/admin/settings/advanced', routes).path, '/admin/settings');
  assert.equal(matchRoute('/admin/posts', routes).path, '/admin');
  assert.equal(matchRoute('/dashboard', routes).path, '/');
  assert.equal(matchRoute('/not-exist', routes).path, '/');
});

test('auth middleware does not trust unverified JWT role claims', async () => {
  const authGuardPath = path.join(process.cwd(), 'src', 'middleware', 'authGuard.ts');
  const content = await fs.readFile(authGuardPath, 'utf-8');

  assert.equal(content.includes('atob('), false);
  assert.equal(content.includes("userRole === 'SUPER_ADMIN'"), false);
  assert.equal(content.includes('ROLE_LEVELS'), false);
});

test('route whitelist keeps /admin as a built-in protected fallback', async () => {
  const routeWhitelistPath = path.join(process.cwd(), 'src', 'middleware', 'routeWhitelist.ts');
  const content = await fs.readFile(routeWhitelistPath, 'utf-8');

  assert.match(content, /path: '\/admin'/);
  assert.match(content, /minRole: 'MODERATOR'/);
  assert.match(content, /mergeWithFallbackWhitelist/);
  assert.match(content, /merged\.set\('\/admin:prefix'/);
});

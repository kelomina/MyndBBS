import assert from 'node:assert/strict';
import test from 'node:test';

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

import assert from 'node:assert/strict';
import test from 'node:test';

test('frontend exports types entry', async () => {
  const mod = await import('../src/types/index.ts');
  assert.ok(mod);
});

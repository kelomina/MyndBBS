import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
  cleanNextDevCache,
  isPathInsideProject,
  resolveNextDevCachePath,
} from '../scripts/clean-next-dev-cache.mjs';

test('cleanNextDevCache removes stale Next.js dev type cache', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'myndbbs-next-cache-'));
  const devCachePath = resolveNextDevCachePath(projectRoot);

  try {
    await mkdir(join(devCachePath, 'types'), { recursive: true });
    await writeFile(join(devCachePath, 'types', 'validator.ts'), 'ore');

    const removedPath = await cleanNextDevCache(projectRoot);

    assert.equal(removedPath, devCachePath);
    await assert.rejects(access(devCachePath));
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('isPathInsideProject rejects paths outside the project root', () => {
  const projectRoot = resolve('project-root');
  const siblingPath = resolve('project-root-sibling', '.next', 'dev');

  assert.equal(isPathInsideProject(projectRoot, resolve(projectRoot, '.next', 'dev')), true);
  assert.equal(isPathInsideProject(projectRoot, siblingPath), false);
});

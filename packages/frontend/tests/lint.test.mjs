import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';

function run(command, args, options) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        ...options,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          CI: 'true',
          ...(options?.env ?? {}),
        },
      });
    } catch (error) {
      resolve({ code: null, stdout: '', stderr: '', error });
      return;
    }

    let stdout = '';
    let stderr = '';
    let error = null;

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (spawnError) => {
      error = spawnError;
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr, error });
    });
  });
}

test('frontend lint passes', { timeout: 10 * 60 * 1000 }, async (t) => {
  const result = await run('pnpm', ['lint'], { cwd: new URL('../', import.meta.url) });
  if (result.error?.code === 'ENOENT' || result.error?.code === 'EPERM') {
    t.skip(`Skipping lint integration check because pnpm cannot be spawned in this environment: ${result.error.code}`);
    return;
  }
  assert.equal(
    result.code,
    0,
    `pnpm lint failed\n\nstdout:\n${result.stdout}\n\nstderr:\n${result.stderr}\n`,
  );
});

test('frontend lint has zero warnings', { timeout: 10 * 60 * 1000 }, async (t) => {
  const result = await run(
    'pnpm',
    ['exec', 'eslint', '--max-warnings', '0'],
    { cwd: new URL('../', import.meta.url) },
  );
  if (result.error?.code === 'ENOENT' || result.error?.code === 'EPERM') {
    t.skip(`Skipping lint warning check because pnpm cannot be spawned in this environment: ${result.error.code}`);
    return;
  }
  assert.equal(
    result.code,
    0,
    `pnpm exec eslint --max-warnings 0 failed\n\nstdout:\n${result.stdout}\n\nstderr:\n${result.stderr}\n`,
  );
});

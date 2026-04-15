import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';

function run(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CI: 'true',
        ...(options?.env ?? {}),
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

test('frontend lint passes', { timeout: 10 * 60 * 1000 }, async () => {
  const result = await run('pnpm', ['lint'], { cwd: new URL('../', import.meta.url) });
  assert.equal(
    result.code,
    0,
    `pnpm lint failed\n\nstdout:\n${result.stdout}\n\nstderr:\n${result.stderr}\n`,
  );
});

test('frontend lint has zero warnings', { timeout: 10 * 60 * 1000 }, async () => {
  const result = await run(
    'pnpm',
    ['exec', 'eslint', '--max-warnings', '0'],
    { cwd: new URL('../', import.meta.url) },
  );
  assert.equal(
    result.code,
    0,
    `pnpm exec eslint --max-warnings 0 failed\n\nstdout:\n${result.stdout}\n\nstderr:\n${result.stderr}\n`,
  );
});

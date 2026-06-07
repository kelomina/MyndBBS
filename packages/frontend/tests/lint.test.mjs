import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';

/**
 * Callers: [frontend lint integration tests]
 * Callees: [process.platform]
 * Description: Returns a pnpm process invocation that avoids Windows `.cmd` spawn errors and avoids `shell: true` argument warnings.
 * 描述：返回 pnpm 进程调用参数，避免 Windows `.cmd` spawn 错误，同时避免 `shell: true` 参数警告。
 * Variables: `args` are pnpm CLI arguments; `process.platform` identifies the OS; `cmd.exe` runs command shims on Windows.
 * 变量：`args` 是 pnpm CLI 参数；`process.platform` 标识操作系统；`cmd.exe` 在 Windows 上运行命令 shim。
 * Integration: Use this helper whenever frontend node tests need to launch pnpm.
 * 接入方式：前端 node 测试需要启动 pnpm 时调用本函数。
 * Error Handling: Unsupported PATH setups are still surfaced by the caller as spawn errors.
 * 错误处理：不支持的 PATH 配置仍由调用方作为 spawn 错误暴露。
 * Keywords: pnpm spawn, windows shim, lint test, node test, cross platform, pnpm启动, Windows脚本, lint测试, node测试, 跨平台
 */
function resolvePnpmInvocation(args) {
  if (process.platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'pnpm', ...args],
    };
  }

  return {
    command: 'pnpm',
    args,
  };
}

/**
 * Callers: [frontend lint passes, frontend lint has zero warnings]
 * Callees: [spawn]
 * Description: Runs a child process and captures stdout, stderr, exit code, and spawn errors for assertion messages.
 * 描述：运行子进程，并捕获 stdout、stderr、退出码和 spawn 错误，供断言信息使用。
 * Variables: `command` is the executable; `args` are CLI arguments; `options` provides cwd/env; `stdout` and `stderr` collect output; `error` stores spawn failures.
 * 变量：`command` 是可执行文件；`args` 是 CLI 参数；`options` 提供 cwd/env；`stdout` 和 `stderr` 收集输出；`error` 保存 spawn 失败。
 * Integration: Pass a resolved executable name and working directory from node tests.
 * 接入方式：从 node 测试传入解析后的可执行文件名和工作目录。
 * Error Handling: Synchronous spawn failures and asynchronous `error` events are returned instead of thrown.
 * 错误处理：同步 spawn 失败和异步 `error` 事件都会作为结果返回，而不是直接抛出。
 * Keywords: child process, stdout capture, stderr capture, exit code, spawn error, 子进程, 标准输出, 标准错误, 退出码, 启动错误
 */
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

    child.on('close', (code, signal) => {
      resolve({ code, signal, stdout, stderr, error });
    });
  });
}

test('frontend lint passes', { timeout: 10 * 60 * 1000 }, async (t) => {
  const invocation = resolvePnpmInvocation(['lint']);
  const result = await run(invocation.command, invocation.args, { cwd: new URL('../', import.meta.url) });
  if (result.error?.code === 'ENOENT' || result.error?.code === 'EPERM') {
    t.skip(`Skipping lint integration check because pnpm cannot be spawned in this environment: ${result.error.code}`);
    return;
  }
  assert.equal(
    result.code,
    0,
    `pnpm lint failed\n\nstdout:\n${result.stdout}\n\nstderr:\n${result.stderr}\n\nsignal:\n${result.signal ?? ''}\n\nerror:\n${result.error?.message ?? ''}\n`,
  );
});

test('frontend lint has zero warnings', { timeout: 10 * 60 * 1000 }, async (t) => {
  const invocation = resolvePnpmInvocation(['exec', 'eslint', '--max-warnings', '0']);
  const result = await run(invocation.command, invocation.args, { cwd: new URL('../', import.meta.url) });
  if (result.error?.code === 'ENOENT' || result.error?.code === 'EPERM') {
    t.skip(`Skipping lint warning check because pnpm cannot be spawned in this environment: ${result.error.code}`);
    return;
  }
  assert.equal(
    result.code,
    0,
    `pnpm exec eslint --max-warnings 0 failed\n\nstdout:\n${result.stdout}\n\nstderr:\n${result.stderr}\n\nsignal:\n${result.signal ?? ''}\n\nerror:\n${result.error?.message ?? ''}\n`,
  );
});

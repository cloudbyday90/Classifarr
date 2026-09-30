/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
import { childEnvironment } from './contract.mjs';

const execute = promisify(execFile);

export async function asUser(user, command, args, { admin = false, restored = false, timeout = 120_000 } = {}) {
  return execute('/sbin/su-exec', [user, command, ...args], {
    cwd: '/app', env: childEnvironment({ admin, restored }), timeout,
    killSignal: 'SIGKILL', maxBuffer: 8 * 1024 * 1024,
  });
}

export function startRuntime() {
  const child = spawn('/sbin/su-exec', ['classifarr', 'node', 'src/index.mjs'], {
    cwd: '/app', env: childEnvironment(), stdio: ['ignore', 'inherit', 'inherit'],
  });
  // Attach immediately, before waiting for HTTP; no unhandled error/exit race.
  const done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  done.catch(() => { /* swallow-error: readiness/stop awaits the same failure. */ });
  return { child, done };
}

export async function waitForRuntime({ child }, timeout = 60_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('runtime_exited_before_ready');
    try {
      const response = await fetch('http://127.0.0.1:21324/health', { signal: AbortSignal.timeout(1000) });
      const health = await response.json();
      if (response.ok && health.database === 'connected') return;
    } catch { /* swallow-error: bounded startup poll, never a success without health. */ }
    await sleep(200);
  }
  throw new Error('runtime_readiness_timeout');
}

export async function stopRuntime(runtime, timeout = 15_000) {
  if (!runtime) return;
  runtime.child.kill('SIGTERM');
  let timer;
  try {
    const result = await Promise.race([runtime.done, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('runtime_shutdown_timeout')), timeout);
    })]);
    if (result.code !== 0 || result.signal !== null) throw new Error('runtime_shutdown_failed');
  } catch (error) {
    runtime.child.kill('SIGKILL');
    await runtime.done;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawnSync } from 'node:child_process';

export const DOCKER_CHECK_OUTPUT_LIMIT = 64 * 1024;

/** Private capture only. Callers must project output before publishing it. */
export function runDockerCheckCommand(args, { timeoutMs = 5000, run = spawnSync, env = process.env } = {}) {
  try {
    const result = run('docker', args, { encoding: 'utf8', shell: false, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'], env, timeout: Math.max(1, Math.floor(timeoutMs)),
      killSignal: 'SIGKILL', maxBuffer: DOCKER_CHECK_OUTPUT_LIMIT });
    return { ok: !result.error && result.status === 0,
      stdout: String(result.stdout ?? '').slice(-DOCKER_CHECK_OUTPUT_LIMIT),
      stderr: String(result.stderr ?? '').slice(-DOCKER_CHECK_OUTPUT_LIMIT),
      timedOut: result.error?.code === 'ETIMEDOUT',
      outputLimited: result.error?.code === 'ENOBUFS',
      exitCode: Number.isSafeInteger(result.status) ? result.status : null };
  } catch {
    return { ok: false, stdout: '', stderr: '', timedOut: false, outputLimited: false, exitCode: null };
  }
}

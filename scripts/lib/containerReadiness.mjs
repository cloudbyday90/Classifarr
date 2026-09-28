/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setTimeout as delay } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { runDockerCheckCommand } from './dockerCheckCommand.mjs';
import { readContainerStartupState, collectContainerStartupDiagnostic,
  formatContainerStartupDiagnostic } from './containerStartupDiagnostics.mjs';

/** Keep application health mandatory; Docker's running/healthy flags are not enough. */
export async function waitForContainerReady(containerName, { timeoutMs = 180_000,
  command = runDockerCheckCommand, now = () => performance.now(), sleep = delay } = {}) {
  const startedAt = now();
  const remaining = () => Math.max(0, timeoutMs - (now() - startedAt));
  let reason = 'readiness_timeout', httpStatus = null;
  while (remaining() > 0) {
    const state = readContainerStartupState(containerName, { command, timeoutMs: Math.min(5000, remaining()) });
    if (!state.available) {
      reason = remaining() > 0 ? 'container_inspection_failed' : 'readiness_timeout';
      break;
    }
    if (['exited', 'dead', 'removing'].includes(state.status)) { reason = 'container_exited_before_ready'; break; }
    if (remaining() <= 0) break;
    const response = command(['exec', containerName, 'curl', '--fail', '--silent', '--show-error',
      '--connect-timeout', '1', '--max-time', '2', '--output', '/dev/null', '--write-out', '%{http_code}',
      'http://127.0.0.1:21324/health'], { timeoutMs: Math.min(5000, remaining()) });
    httpStatus = /^[1-5]\d{2}$/.test(response.stdout) ? Number(response.stdout) : null;
    if (response.ok && httpStatus >= 200 && httpStatus < 300 && remaining() > 0) return;
    await sleep(Math.min(2000, remaining()));
  }
  const diagnostic = collectContainerStartupDiagnostic(containerName, { command });
  const error = new Error(`Container startup failed: ${reason}; elapsedMs=${Math.round(now() - startedAt)}; ` +
    `lastHealthStatus=${httpStatus ?? 'unavailable'}.\n${formatContainerStartupDiagnostic(diagnostic)}`);
  error.code = reason;
  error.diagnostic = diagnostic;
  throw error;
}

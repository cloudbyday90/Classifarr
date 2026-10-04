/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runDockerCheckCommand } from './dockerCheckCommand.mjs';
import { readContainerLifecycleEvents, formatContainerLifecycleEvents } from './containerLifecycleDiagnostics.mjs';

// Never request .Config, raw .State.Error or health-check logs (they can contain secrets).
const STATE_FORMAT = '{"status":{{json .State.Status}},"exitCode":{{.State.ExitCode}},' +
  '"oomKilled":{{.State.OOMKilled}},"errorPresent":{{if .State.Error}}true{{else}}false{{end}},' +
  '"health":{{if .State.Health}}{{json .State.Health.Status}}{{else}}"none"{{end}}}';
const STATUSES = new Set(['created', 'running', 'paused', 'restarting', 'removing', 'exited', 'dead']);
const HEALTH = new Set(['none', 'starting', 'healthy', 'unhealthy']);
const SIGNALS = [
  ['restore_verification_incomplete', 'Restore verification is incomplete.',
    'Restore verification is incomplete. Inspect the disposable restore fixture and seed migration; do not bypass admission.'],
  ['restore_maintenance_active', 'Restore maintenance is active. Normal startup is blocked.',
    'Restore maintenance owns admission. Check the test phase and maintenance owner before retrying.'],
  ['database_pool_too_small', 'Normal runtime admission requires POSTGRES_POOL_MAX of at least 2.',
    'Set the disposable test database pool to at least two connections and rerun.'],
  ['runtime_ownership_lost', 'Runtime database ownership lost; stopping all work.',
    'Database ownership was lost. Investigate the disposable database connection before rerunning.'],
  ['module_not_found', 'ERR_MODULE_NOT_FOUND', 'An application module is missing. Check the image build inputs and ESM imports.'],
  ['application_start_failed', 'Failed to start server:',
    'Application startup failed, but its specific cause is unrecognized. Reproduce in an isolated environment and inspect private logs.'],
  ['database_startup_failed', 'PostgreSQL startup did not complete.',
    'PostgreSQL startup failed. Inspect the isolated database startup and storage; do not remove ownership files or bypass admission.'],
  ['database_pid_lock_exists', 'FATAL:  lock file "postmaster.pid" already exists',
    'PostgreSQL refused an existing PID lock. Verify process identity in the isolated fixture; do not delete the lock based on age.'],
  ['supervisor_startup_refused', 'Embedded supervisor refused startup;',
    'The embedded supervisor refused startup. Check the packaged entrypoint and disposable test configuration.'],
];

export function readContainerStartupState(containerName, { command = runDockerCheckCommand, timeoutMs = 5000 } = {}) {
  const result = command(['inspect', '--type', 'container', '--format', STATE_FORMAT, containerName], { timeoutMs });
  if (!result.ok) return { available: false, timedOut: result.timedOut === true };
  try {
    const state = JSON.parse(result.stdout);
    if (!STATUSES.has(state.status) || !HEALTH.has(state.health) ||
      !Number.isSafeInteger(state.exitCode) || state.exitCode < 0 || state.exitCode > 255 ||
      typeof state.oomKilled !== 'boolean' || typeof state.errorPresent !== 'boolean') throw new Error('invalid_state');
    return { available: true, status: state.status, exitCode: state.exitCode, oomKilled: state.oomKilled,
      errorPresent: state.errorPresent, health: state.health };
  } catch { return { available: false, timedOut: false }; }
}

/** Log matches are observations, never startup admission or readiness authority. */
export function collectContainerStartupDiagnostic(containerName, { command = runDockerCheckCommand } = {}) {
  const state = readContainerStartupState(containerName, { command });
  const logs = command(['logs', '--tail', '100', containerName], { timeoutMs: 5000 });
  const signals = [];
  for (const stream of ['stdout', 'stderr']) {
    const content = typeof logs[stream] === 'string' ? logs[stream] : '';
    for (const [code, marker] of SIGNALS) {
      if (content.includes(marker)) signals.push({ code, stream });
    }
  }
  return { state, signals, lifecycle: readContainerLifecycleEvents(logs), logs: { available: logs.ok === true, timedOut: logs.timedOut === true,
    outputLimited: logs.outputLimited === true, stdoutPresent: Boolean(logs.stdout), stderrPresent: Boolean(logs.stderr) } };
}

export function formatContainerStartupDiagnostic(diagnostic) {
  const { state, signals, logs, lifecycle } = diagnostic;
  const evidence = state.available
    ? `Container: ${state.status}; exit=${state.exitCode}; OOM=${state.oomKilled}; health=${state.health}; runtimeError=${state.errorPresent}.`
    : `Container state unavailable${state.timedOut ? ' (inspection timed out)' : ''}.`;
  const signalText = signals.map(({ code, stream }) => `${code} (${stream})`).join(', ') || 'none recognized';
  const next = state.oomKilled ? 'Check the disposable runner memory limit and usage; exit code alone does not diagnose OOM.'
    : SIGNALS.find(([code]) => signals.some(signal => signal.code === code))?.[2]
      ?? (state.available ? 'Reproduce with the same image in isolation and inspect startup/health configuration.'
        : 'Check Docker daemon availability and the owned test container; rerun after access is restored.');
  return `${evidence}\nStartup signals: ${signalText}.\n` +
    (lifecycle ? `${formatContainerLifecycleEvents(lifecycle)}\n` : '') +
    `Log tail: ${logs.available ? 'collected' : 'unavailable or partial'}; stdout=${logs.stdoutPresent}; stderr=${logs.stderrPresent}; ` +
    `timedOut=${logs.timedOut}; outputLimited=${logs.outputLimited}. Raw output omitted.\nNext: ${next}`;
}

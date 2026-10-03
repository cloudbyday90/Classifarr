/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { runDockerCheckCommand, DOCKER_CHECK_OUTPUT_LIMIT } from '../../../../scripts/lib/dockerCheckCommand.mjs';
import { readContainerStartupState, collectContainerStartupDiagnostic,
  formatContainerStartupDiagnostic } from '../../../../scripts/lib/containerStartupDiagnostics.mjs';
import { waitForContainerReady } from '../../../../scripts/lib/containerReadiness.mjs';

const running = { status: 'running', exitCode: 0, oomKilled: false, errorPresent: false, health: 'healthy' };
function fixture({ state = running, health = '503', logs = {}, inspectOk = true } = {}) {
  return jest.fn(args => {
    if (args[0] === 'inspect') return { ok: inspectOk, stdout: JSON.stringify(state) };
    if (args[0] === 'exec') return { ok: health === '200', stdout: health };
    return { ok: true, stdout: '', stderr: '', ...logs };
  });
}

test('Docker adapter preserves both streams even on success with bounded shell-free execution', () => {
  const run = jest.fn(() => ({ status: 0, stdout: 'out', stderr: 'err' }));
  expect(runDockerCheckCommand(['logs', 'fixture'], { run, timeoutMs: 42 }))
    .toMatchObject({ ok: true, stdout: 'out', stderr: 'err', exitCode: 0 });
  expect(run.mock.calls[0]).toEqual(['docker', ['logs', 'fixture'], expect.objectContaining({
    shell: false, windowsHide: true, timeout: 42, killSignal: 'SIGKILL', maxBuffer: DOCKER_CHECK_OUTPUT_LIMIT,
  })]);
});

test.each(['ETIMEDOUT', 'ENOBUFS', 'ENOENT'])('classifies %s without publishing raw process errors', code => {
  const result = runDockerCheckCommand([], { run: () => ({ error: { code, message: 'secret' }, status: null }) });
  expect(result).toMatchObject({ ok: false, exitCode: null, timedOut: code === 'ETIMEDOUT', outputLimited: code === 'ENOBUFS' });
  expect(JSON.stringify(result)).not.toContain('secret');
  expect(runDockerCheckCommand([], { run: () => { throw new Error('secret'); } }).ok).toBe(false);
});

test('real child process timeout terminates promptly without relying on Docker', () => {
  const start = Date.now();
  const result = runDockerCheckCommand([], { timeoutMs: 100.75, run: (_binary, _args, options) =>
    spawnSync(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], options) });
  expect(result).toMatchObject({ ok: false, timedOut: true });
  expect(Date.now() - start).toBeLessThan(5000);
});

test('real child output overflow is bounded and explicitly classified', () => {
  const result = runDockerCheckCommand([], { run: (_binary, _args, options) =>
    spawnSync(process.execPath, ['-e', 'process.stdout.write("x".repeat(200000))'], options) });
  expect(result).toMatchObject({ ok: false, outputLimited: true });
  expect(result.stdout.length).toBeLessThanOrEqual(DOCKER_CHECK_OUTPUT_LIMIT);
});

test.each(['status', 'exitCode', 'oomKilled', 'errorPresent', 'health'])('rejects untrusted %s in inspection', key => {
  expect(readContainerStartupState('fixture', { command: fixture({ state: { ...running, [key]: 'secret' } }) }))
    .toEqual({ available: false, timedOut: false });
});

test('rejects invalid JSON and projects only allowlisted state', () => {
  expect(readContainerStartupState('fixture', { command: () => ({ ok: true, stdout: 'not-json' }) }).available).toBe(false);
  const state = readContainerStartupState('fixture', { command: fixture({ state: { ...running, Env: ['SECRET=private'] } }) });
  expect(JSON.stringify(state)).not.toContain('private');
});

test('collects the stderr-only admission failure and excludes credentials and CI commands', () => {
  const command = fixture({ state: { ...running, status: 'exited', exitCode: 1 }, logs: {
    stdout: 'password=private-data\n::error::injection\n\u001b[31mprivate-data',
    stderr: 'Failed to start server: Restore verification is incomplete. Restart in restore mode to investigate or retry.\npostgres://private-data',
  } });
  const diagnostic = collectContainerStartupDiagnostic('fixture', { command });
  const text = formatContainerStartupDiagnostic(diagnostic);
  expect(text).toContain('restore_verification_incomplete (stderr)');
  expect(text).toContain('exit=1');
  expect(text).toContain('do not bypass admission');
  expect(JSON.stringify(diagnostic) + text).not.toMatch(/private-data|::error::|\u001b/);
  expect(command.mock.calls[1][0]).toEqual(['logs', '--tail', '100', 'fixture']);
  expect(command.mock.calls.every(([, options]) => options.timeoutMs <= 5000)).toBe(true);
});

test.each([true, false])('only explicit OOMKilled identifies OOM (flag=%s)', oomKilled => {
  const diagnostic = collectContainerStartupDiagnostic('fixture', {
    command: fixture({ state: { ...running, status: 'exited', exitCode: 137, oomKilled } }),
  });
  expect(formatContainerStartupDiagnostic(diagnostic).includes('Check the disposable runner memory limit')).toBe(oomKilled);
});

test('unknown or missing logs cannot manufacture a cause', () => {
  const text = formatContainerStartupDiagnostic(collectContainerStartupDiagnostic('fixture', {
    command: fixture({ inspectOk: false, logs: { ok: false, stderr: 'secret', timedOut: true } }),
  }));
  expect(text).toContain('none recognized');
  expect(text).toContain('unavailable');
  expect(text).not.toContain('secret');
});

test('shows fixed database and supervisor phases from both streams, even with partial logs', () => {
  const diagnostic = collectContainerStartupDiagnostic('fixture', { command: fixture({ logs: {
    ok: false, timedOut: true,
    stdout: JSON.stringify({ component: 'EmbeddedDatabaseStartup', status: 'failed',
      reason: 'database_startup_process_exited', detail: 'private-cause' }),
    stderr: JSON.stringify({ component: 'EmbeddedSupervisor', status: 'startup_failed', reason: 'database_operation_timeout' }),
  } }) });
  const text = formatContainerStartupDiagnostic(diagnostic);
  expect(text).toContain('EmbeddedDatabaseStartup:failed/database_startup_process_exited (stdout)');
  expect(text).toContain('EmbeddedSupervisor:startup_failed/database_operation_timeout (stderr)');
  expect(text).toContain('per stream only');
  expect(text).toContain('unavailable or partial');
  expect(text).not.toContain('private-cause');
});

test.each([
  ['Normal runtime admission requires POSTGRES_POOL_MAX of at least 2.', 'database_pool_too_small'],
  ['Runtime database ownership lost; stopping all work.', 'runtime_ownership_lost'],
  ['ERR_MODULE_NOT_FOUND private-path', 'module_not_found'],
  ['Failed to start server: private-cause', 'application_start_failed'],
  ['PostgreSQL startup did not complete. private-cause', 'database_startup_failed'],
  ['Embedded supervisor refused startup; private-cause', 'supervisor_startup_refused'],
])('projects the startup marker %s without arbitrary error detail', (stderr, code) => {
  const text = formatContainerStartupDiagnostic(collectContainerStartupDiagnostic('fixture', {
    command: fixture({ logs: { stderr } }),
  }));
  expect(text).toContain(code);
  expect(text).not.toContain('private-');
});

test('requires application health even when Docker says healthy; emits no failure logs on success', async () => {
  const command = fixture({ health: '200' });
  await waitForContainerReady('fixture', { command });
  expect(command.mock.calls.map(([args]) => args[0])).toEqual(['inspect', 'exec']);
  expect(command.mock.calls[1][0]).toContain('--max-time');
});

test.each(['exited', 'dead', 'removing'])('reports %s immediately without sleeping or probing', async status => {
  const command = fixture({ state: { ...running, status, exitCode: 1 } });
  const sleep = jest.fn();
  await expect(waitForContainerReady('fixture', { command, sleep })).rejects.toMatchObject({ code: 'container_exited_before_ready' });
  expect(sleep).not.toHaveBeenCalled();
  expect(command.mock.calls.some(([args]) => args[0] === 'exec')).toBe(false);
});

test('inspection failure is not a readiness timeout and diagnostics cannot swallow it', async () => {
  await expect(waitForContainerReady('fixture', { command: fixture({ inspectOk: false }) }))
    .rejects.toMatchObject({ code: 'container_inspection_failed' });
});

test.each(['503', '302', '000', 'private-body'])('bounds unready health %s to the original deadline', async health => {
  let time = 0;
  const command = fixture({ health });
  await expect(waitForContainerReady('fixture', { command, timeoutMs: 2500, now: () => time,
    sleep: async duration => { time += duration; } })).rejects.toMatchObject({ code: 'readiness_timeout' });
  expect(time).toBe(2500);
  const probes = command.mock.calls.filter(([args]) => args[0] === 'exec');
  expect(probes.map(([, options]) => options.timeoutMs)).toEqual([2500, 500]);
});

test('a slow successful probe after deadline cannot pass', async () => {
  let time = 0;
  const inner = fixture({ health: '200' });
  const command = (args, options) => { if (args[0] === 'exec') time += options.timeoutMs; return inner(args); };
  await expect(waitForContainerReady('fixture', { command, timeoutMs: 10, now: () => time, sleep: async () => {} }))
    .rejects.toThrow('readiness_timeout');
});

test('inspection exhausting the remaining readiness budget is still a readiness timeout', async () => {
  let time = 0;
  const command = (_args, options) => { time += options.timeoutMs; return { ok: false, timedOut: true }; };
  await expect(waitForContainerReady('fixture', { command, timeoutMs: 10, now: () => time }))
    .rejects.toThrow('readiness_timeout');
});

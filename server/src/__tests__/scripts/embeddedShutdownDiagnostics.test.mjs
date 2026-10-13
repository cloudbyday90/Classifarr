/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { projectShutdownError, recordShutdownCommandFailure } from '../../../../scripts/lib/embeddedShutdownDiagnostics.mjs';
import { createShutdownReport } from '../../../../scripts/lib/embeddedShutdownReport.mjs';
import { runShutdownDrillCli } from '../../../../scripts/run-embedded-shutdown-drill.mjs';

test('projects nested errors without leaking messages, output, SQL or paths', () => {
  const secret = 'password=very-private-token';
  const child = Object.assign(new Error(secret), { code: 1, stdout: secret,
    stderr: `Error response from daemon: volume is in use ${secret}`, signal: secret });
  recordShutdownCommandFailure(child, { phase: 'cleanup', operation: 'volume_rm', resource: null, timeoutMs: 30_000, elapsedMs: 120 });
  const original = Object.assign(new Error(secret, { cause: child }), { code: 'ERR_ASSERTION', actual: secret, expected: secret });
  original.stack = `Error: ${secret}\n at file:///private/user/${secret}/embeddedShutdownChecks.mjs:30:5`;
  const result = projectShutdownError(new AggregateError([original, child], secret));
  expect(result.errors[0]).toMatchObject({ code: 'ERR_ASSERTION', locations: ['embeddedShutdownChecks.mjs:30:5'],
    cause: { command: { category: 'volume_in_use', exitCode: 1, signal: null } } });
  expect(JSON.stringify(result)).not.toMatch(/very-private-token|password|private\/user/);
});

test('bounds oversized and cyclic causes and aggregates', () => {
  const error = new AggregateError(Array.from({ length: 10_000 }, () => new Error('private')), 'private');
  error.cause = error;
  const result = projectShutdownError(error);
  expect(result.cause.code).toBe('error_detail_truncated');
  expect(result.errors).toHaveLength(8);
  expect(result.truncated).toBe(true);
  expect(JSON.stringify(result).length).toBeLessThan(2_000);
  expect(projectShutdownError('private')).toEqual({ code: 'unknown_error' });
});

test.each([
  [{ code: 'ETIMEDOUT' }, 'command_timeout'],
  [{ killed: true, signal: 'SIGTERM' }, 'command_timeout'],
  [{ stderr: 'permission denied secret' }, 'permission_denied'],
  [{ stderr: 'cannot connect to the Docker daemon secret' }, 'daemon_unavailable'],
  [{ stderr: 'removal is already in progress secret' }, 'removal_in_progress'],
  [{ code: 'SECRET' }, 'command_failed'],
])('reports a safe command category for %j', (error, category) => {
  expect(recordShutdownCommandFailure(error, { timeoutMs: 100, elapsedMs: 100 }).category).toBe(category);
});

test('report starts running, binds workflow context, replaces an attempt and preserves failure', () => {
  const save = jest.fn(), env = { GITHUB_SHA: 'a'.repeat(40), GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2', SECRET: 'private' };
  const report = createShutdownReport('queue', { save, env });
  expect(save.mock.calls[0][1].status).toBe('running');
  report.update({ resources: { container: 'fixture' }, status: 'running' });
  report.update({ resources: { container: 'fixture' }, status: 'failed' });
  const result = report.finish(new Error('queue_claim_wait_failed:private'));
  expect(result).toMatchObject({ status: 'failed', sourceRevision: env.GITHUB_SHA, workflow: { runId: '123', runAttempt: '2' },
    failure: { code: 'queue_claim_wait_failed' }, attempts: [{ resources: { container: 'fixture' }, status: 'failed' }] });
  expect(JSON.stringify(result)).not.toContain('private');
});

test('rejects unbounded workflow identifiers and failed persistence', () => {
  const report = createShutdownReport('http', { save: jest.fn(), env: { GITHUB_SHA: 'private', GITHUB_RUN_ID: '1\nprivate' } });
  expect(report.finish()).toMatchObject({ sourceRevision: null, workflow: { runId: null, runAttempt: null } });
  expect(() => createShutdownReport('queue', { save: () => { throw new Error('secret disk path'); } })).toThrow('shutdown_diagnostics_write_failed');
});

test.each([[[]], [['--queue-claims']]])('CLI records failure and rejects rather than masking it (%j)', async args => {
  const failure = new AggregateError([new Error('ERR_ASSERTION'), new Error('shutdown_resource_remains')], 'shutdown_drill_cleanup_failed:fixture');
  const runner = jest.fn(async () => { throw failure; });
  const report = { update: jest.fn(), finish: jest.fn() };
  await expect(runShutdownDrillCli(args, { http: runner, queue: runner, createReport: () => report })).rejects.toBe(failure);
  expect(report.finish).toHaveBeenCalledWith(failure);
});

test('CLI retains the scenario error when final report persistence fails', async () => {
  const failure = new Error('queue_claim_wait_failed:private');
  let actual;
  try {
    await runShutdownDrillCli([], { http: async () => { throw failure; }, createReport: () => ({ update() {},
      finish() { throw new Error('shutdown_diagnostics_write_failed'); } }) });
  } catch (error) { actual = error; }
  expect(actual.errors[0]).toBe(failure);
  expect(actual.errors[1].message).toBe('shutdown_diagnostics_write_failed');
});

test('actual CLI exits nonzero with sanitized invalid-input diagnostics', () => {
  let failure;
  try { execFileSync(process.execPath, [resolve(import.meta.dirname, '../../../../scripts/run-embedded-shutdown-drill.mjs'), '--secret-token'], { encoding: 'utf8', stdio: 'pipe' }); }
  catch (error) { failure = error; }
  expect(failure.status).toBe(1);
  expect(failure.stderr).toContain('invalid_arguments');
  expect(failure.stderr).not.toContain('secret-token');
});

/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import assert from 'node:assert/strict';
import { captureRoutingFailureContext, routingFailureDiagnostic } from '../../../../scripts/lib/routingFailureDiagnostic.mjs';

test.each([
  ['routing_wait_timeout', 'wait_timeout'],
  ['routing_probe_failed:assertion_failed_probe_53', 'probe_failed'],
  ['routing_probe_failed:missed_crash_window_probe_54', 'crash_window_expired'],
  ['sensitive provider response', 'unexpected_failure'],
])('classifies failure without serializing the original error: %s', (message, reason) => {
  const result = routingFailureDiagnostic(new Error(message), 'crash-ready');
  expect(result).toMatchObject({ phase: 'crash-ready', reason });
  expect(JSON.stringify(result)).not.toContain(message);
});

test('includes only known probe source coordinates, not assertion or SQL values', () => {
  expect(routingFailureDiagnostic(new Error('routing_probe_failed:secret_seed_91_23505'), 'seed'))
    .toEqual({ phase: 'seed', reason: 'probe_failed', location: { file: 'seed.mjs', line: 91 } });
  for (const suffix of ['secret_42', 'probe_0', 'probe_100000', 'probe_17\nsecret']) {
    expect(routingFailureDiagnostic(new Error(`routing_probe_failed:${suffix}`), 'seed'))
      .toEqual({ phase: 'seed', reason: 'probe_failed' });
  }
});

test('normalizes unknown phases and unexpected values without copying them', () => {
  const error = Object.assign(new Error('password=secret'), { code: 'ERR_ASSERTION', actual: 'token' });
  expect(routingFailureDiagnostic(error, 'private-library'))
    .toEqual({ phase: 'preflight', reason: 'assertion_failed' });
  expect(routingFailureDiagnostic(null, null)).toEqual({ phase: 'preflight', reason: 'unexpected_failure' });
});

test('limits Docker diagnostics to known commands and reports cleanup failure precedence', () => {
  expect(routingFailureDiagnostic(new Error('routing_docker_failed:kill'), 'forced-restart'))
    .toEqual({ phase: 'forced-restart', reason: 'docker_failed', command: 'kill' });
  expect(routingFailureDiagnostic(new Error('routing_docker_failed:secret'), 'forced-restart'))
    .toEqual({ phase: 'forced-restart', reason: 'unexpected_failure' });
  expect(routingFailureDiagnostic(new Error(`routing_cleanup_failed:classifarr-routing-drill-${'a'.repeat(32)}`), 'complete'))
    .toEqual({ phase: 'cleanup', reason: 'cleanup_failed' });
});

test('captures only allowlisted container context, never raw errors, logs or assertion values', () => {
  const error = Object.assign(new Error('routing_startup_failed'), { code: 'ERR_ASSERTION', actual: 'private-token' });
  const command = jest.fn(args => args[0] === 'inspect' ? { ok: true, stdout: JSON.stringify({
    status: 'exited', exitCode: 1, oomKilled: false, errorPresent: false, health: 'unhealthy', token: 'private-token',
  }) } : { ok: true, stdout: 'private-token\n' + JSON.stringify({ component: 'EmbeddedSupervisor',
    status: 'startup_failed', reason: 'database_unavailable', password: 'private-token' }), stderr: 'private-token' });
  captureRoutingFailureContext(error, `classifarr-routing-drill-${'a'.repeat(32)}`, { command });
  const result = routingFailureDiagnostic(error, 'forced-restart');
  expect(result).toMatchObject({ check: 'startup_running', container: {
    state: { available: true, status: 'exited', exitCode: 1, oomKilled: false },
    lifecycle: { events: [{ component: 'EmbeddedSupervisor', status: 'startup_failed', reason: 'database_unavailable', stream: 'stdout' }] },
  } });
  expect(JSON.stringify(result)).not.toContain('private-token');
  expect(command.mock.calls.map(([args, options]) => [args[0], options.timeoutMs])).toEqual([['inspect', 5000], ['logs', 5000]]);
  expect(command.mock.calls[1][0]).toEqual(['logs', '--tail', '100', `classifarr-routing-drill-${'a'.repeat(32)}`]);
  expect(routingFailureDiagnostic(Object.assign(new Error('other'), { container: result.container }), 'forced-restart'))
    .not.toHaveProperty('container');
});

test('does not inspect an ordinary container or retain context on another error', () => {
  const command = jest.fn();
  captureRoutingFailureContext(new Error('failure'), 'classifarr', { command });
  captureRoutingFailureContext(null, `classifarr-routing-drill-${'a'.repeat(32)}`, { command });
  expect(command).not.toHaveBeenCalled();
  expect(routingFailureDiagnostic(new Error('failure'), 'forced-restart')).not.toHaveProperty('container');
});

test('handles real Node assertion errors without publishing the appended diff', () => {
  let failure;
  try { assert.equal('private-token', 137, 'routing_exit_code'); } catch (error) { failure = error; }
  const command = () => ({ ok: false, stdout: '', stderr: '' });
  captureRoutingFailureContext(failure, `classifarr-routing-drill-${'b'.repeat(32)}`, { command });
  const result = routingFailureDiagnostic(failure, 'forced-restart');
  expect(result).toMatchObject({ check: 'exit_code', container: { state: { available: false } } });
  expect(JSON.stringify(result)).not.toContain('private-token');
});

test('retains only the PostgreSQL lock-refusal category, not the PID or data path', () => {
  const error = new Error('routing_startup_failed');
  const command = () => ({ ok: true, stdout: '2026-10-04 FATAL:  lock file "postmaster.pid" already exists\n' +
    'HINT:  Is another postmaster (PID 999) running in data directory "private-path"?', stderr: '' });
  captureRoutingFailureContext(error, `classifarr-routing-drill-${'c'.repeat(32)}`, { command });
  const result = routingFailureDiagnostic(error, 'forced-restart');
  expect(result.container.signals).toEqual([{ code: 'database_pid_lock_exists', stream: 'stdout' }]);
  expect(JSON.stringify(result)).not.toMatch(/999|private-path|FATAL/);
});

/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { routingFailureDiagnostic } from '../../../../scripts/lib/routingFailureDiagnostic.mjs';

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

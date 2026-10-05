/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { diagnoseLiveMultiScaleFailure, describeLiveMultiScaleFailure } from '../../services/liveMultiScaleFailure.mjs';
import { providerResponseError } from '../../services/providerResponseDiagnosis.mjs';

test.each([
  ['08006', 'database_connection'], ['ECONNRESET', 'database_connection'], ['57014', 'database_query_cancelled'],
  ['55P03', 'database_lock_unavailable'], ['42501', 'database_permissions'], ['42P01', 'database_schema'],
  ['42703', 'database_schema'], ['53200', 'database_capacity'], ['40P01', 'database_conflict'],
  ['PRIVATE', 'unknown'],
])('classifies database code %s only at database boundaries', (code, expected) => {
  const error = Object.assign(new Error('PRIVATE SQL'), { code });
  expect(diagnoseLiveMultiScaleFailure('snapshot_read', error)).toEqual({ stage: 'snapshot_read', code: expected });
  expect(diagnoseLiveMultiScaleFailure('profile_build', error)).toEqual({ stage: 'profile_build', code: 'unknown' });
});

test.each(['transport', 'timeout', 'http_auth', 'http_missing', 'http_rejected', 'http_busy', 'body_limit',
  'encoding', 'json', 'model', 'batch', 'shape', 'dimensions', 'nonfinite', 'float32', 'zero', 'representation', 'model_changed'])(
  'reuses provider diagnosis %s with fixed guidance', issue => {
    const failure = diagnoseLiveMultiScaleFailure('provider_inspection', providerResponseError(issue, 'inspection'));
    expect(failure).toEqual({ stage: 'provider_inspection', code: `provider_${issue}` });
    expect(describeLiveMultiScaleFailure(failure)).toEqual({ ...failure, recovery: expect.any(String) });
    expect(diagnoseLiveMultiScaleFailure('snapshot_read', providerResponseError(issue))).toEqual({ stage: 'snapshot_read', code: 'unknown' });
  });

test.each([
  ['multi_scale_complete_cache_required', 'cached_vectors_incomplete'],
  ['inventory_representative_vector_budget', 'source_budget_or_shape'],
  ['multi_scale_source_invalid', 'source_invalid'],
  ['PRIVATE multi_scale_source_invalid', 'unknown'],
])('recognizes exact internal sentinel %s without substring matching', (message, code) => {
  expect(diagnoseLiveMultiScaleFailure('source_validation', new Error(message))).toEqual({ stage: 'source_validation', code });
  expect(diagnoseLiveMultiScaleFailure('state_read', new Error(message))).toEqual({ stage: 'state_read', code: 'unknown' });
});

test('cause traversal is bounded, cycle-safe and getter-safe', () => {
  const leaf = { code: '42501', message: 'PRIVATE' };
  expect(diagnoseLiveMultiScaleFailure('readiness', { cause: { cause: { cause: leaf } } }).code).toBe('database_permissions');
  expect(diagnoseLiveMultiScaleFailure('readiness', { cause: { cause: { cause: { cause: leaf } } } }).code).toBe('unknown');
  const cycle = {}; cycle.cause = cycle;
  expect(diagnoseLiveMultiScaleFailure('readiness', cycle).code).toBe('unknown');
  const hostile = new Proxy({}, { get() { throw new Error('PRIVATE'); } });
  expect(diagnoseLiveMultiScaleFailure('provider_verify', hostile).code).toBe('unknown');
  expect(describeLiveMultiScaleFailure(hostile)).toMatchObject({ stage: 'unknown', code: 'unknown' });
  expect(diagnoseLiveMultiScaleFailure('PRIVATE', leaf)).toEqual({ stage: 'unknown', code: 'unknown' });
});

test('deadline wins over nested faults and operation timeouts remain distinct', () => {
  expect(diagnoseLiveMultiScaleFailure('profile_build', { code: 'INVALID_EMBEDDING' })).toEqual({ stage: 'profile_build', code: 'cached_vector_invalid' });
  expect(diagnoseLiveMultiScaleFailure('state_read', { name: 'TimeoutError' }).code).toBe('operation_timeout');
  expect(diagnoseLiveMultiScaleFailure('state_read', { code: '42501' }, { deadlineExpired: true }).code).toBe('attempt_timeout');
  expect(diagnoseLiveMultiScaleFailure('clock').code).toBe('clock_invalid');
});

test('log boundary rejects arbitrary fields and revalidates provider stages', () => {
  for (const code of ['PRIVATE\nkey', 'constructor', 'provider_PRIVATE', 'provider_' + 'x'.repeat(100), {}, undefined]) {
    const result = describeLiveMultiScaleFailure({ stage: 'PRIVATE', code, recovery: 'PRIVATE', stack: 'PRIVATE' });
    expect(result).toEqual({ stage: 'unknown', code: 'unknown', recovery: expect.stringContaining('open a GitHub issue') });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  }
  expect(describeLiveMultiScaleFailure({ stage: 'state_read', code: 'provider_http_auth' }).code).toBe('unknown');
  expect(describeLiveMultiScaleFailure({ stage: 'state_read', code: 'database_schema' }).recovery).toContain('migration diagnostics');
});

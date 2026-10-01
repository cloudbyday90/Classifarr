/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { buildQueueVacuumDiagnosis, readQueueVacuumDiagnosis } from '../services/queueVacuumDiagnosis.mjs';
import { classifyQueueVacuumFailure, queueVacuumFailureCategory, QueueVacuumAttemptError } from '../services/queueVacuumFailure.mjs';
import { QUEUE_VACUUM_DIAGNOSIS_SQL } from '../services/queueVacuumDiagnosisQuery.mjs';

const row = (values = {}) => ({ queue_present: true, full_activity_visibility: true,
  retaining_transactions: '0', old_transactions: '0', tracking_disabled_sessions: '0',
  old_prepared_transactions: '0', replication_horizons: '0', conflicting_locks: '0',
  waiting_locks: '0', active_vacuums: '0', ...values });

test.each([
  [{}, 'no_blocker_observed'], [{ queue_present: false }, 'queue_missing'],
  [{ conflicting_locks: 1 }, 'lock_interference'], [{ waiting_locks: 1 }, 'lock_interference'],
  [{ old_prepared_transactions: 1 }, 'prepared_horizon'], [{ old_transactions: 1 }, 'transaction_horizon'],
  [{ replication_horizons: 1 }, 'replication_horizon'], [{ active_vacuums: 1 }, 'vacuum_active'],
  [{ full_activity_visibility: false }, 'visibility_limited'], [{ tracking_disabled_sessions: 1 }, 'visibility_limited'],
  [{ retaining_transactions: '9007199254740992' }, 'unavailable'], [{ old_transactions: null }, 'unavailable'],
  [{ old_transactions: -1 }, 'unavailable'], [{ old_transactions: 0.5 }, 'unavailable'],
  [{ old_transactions: {} }, 'unavailable'], [{ queue_present: undefined }, 'unavailable'],
])('snapshot %j maps to %s', (values, reason) => {
  expect(buildQueueVacuumDiagnosis(row(values), 'attempt_limit')).toMatchObject({ reason, failureCategory: 'attempt_limit' });
});

test('possible evidence wins without pretending partial visibility is complete', () => {
  expect(buildQueueVacuumDiagnosis(row({ old_transactions: 1, replication_horizons: 2, full_activity_visibility: false }), 'deadline'))
    .toMatchObject({ reason: 'transaction_horizon', activityVisibility: 'limited' });
  expect(buildQueueVacuumDiagnosis(row({ conflicting_locks: 1, old_prepared_transactions: 1 }), 'deadline').reason)
    .toBe('lock_interference');
});

test.each(['query_canceled', 'deadline', 'permission_denied', 'completion_unverified', 'lock_unavailable', 'connection_lost'])
  ('known category %s retains useful action even without snapshot', category => {
    expect(buildQueueVacuumDiagnosis(row(), category).reason).toBe(category);
    expect(buildQueueVacuumDiagnosis(null, category)).toMatchObject({ status: 'unavailable', failureCategory: category,
      nextStep: buildQueueVacuumDiagnosis(row(), category).nextStep });
  });

test('projection never forwards identifiers, messages or arbitrary fields', () => {
  const result = buildQueueVacuumDiagnosis(row({ query: 'secret', pid: 123, slot_name: 'private', message: 'private' }), 'secret');
  expect(result.failureCategory).toBe('execution_failed');
  expect(JSON.stringify(result)).not.toMatch(/secret|private|slot_name|"pid"|"query"/);
  expect(buildQueueVacuumDiagnosis(undefined, 'secret').evidence).toBeNull();
});

test('one fixed read with three-second cap; failed or absent data is unavailable without retry', async () => {
  const query = jest.fn().mockResolvedValue({ rows: [row()] });
  expect((await readQueueVacuumDiagnosis(query, 'attempt_limit')).status).toBe('observed');
  expect(query.mock.calls).toEqual([[QUEUE_VACUUM_DIAGNOSIS_SQL, [], 3000]]);
  query.mockRejectedValueOnce(new Error('password=secret'));
  expect(JSON.stringify(await readQueueVacuumDiagnosis(query, 'attempt_limit'))).not.toContain('secret');
  query.mockResolvedValueOnce(undefined);
  expect((await readQueueVacuumDiagnosis(query, 'attempt_limit')).status).toBe('unavailable');
  expect(query).toHaveBeenCalledTimes(3);
  expect(QUEUE_VACUUM_DIAGNOSIS_SQL).not.toMatch(/\b(?:DELETE|UPDATE|INSERT|pg_terminate_backend|pg_drop_replication_slot)\b/i);
  expect(QUEUE_VACUUM_DIAGNOSIS_SQL).not.toContain('catalog_xmin');
});

test.each([
  [{ code: '57014', message: 'private' }, {}, 'query_canceled'],
  [{ code: '55P03' }, {}, 'lock_unavailable'], [{ code: '42501' }, {}, 'permission_denied'],
  [{ message: 'queue_vacuum_not_confirmed' }, {}, 'completion_unverified'],
  [{ code: '57014' }, { timedOut: true }, 'deadline'], [{}, { connectionLost: true }, 'connection_lost'],
  [{ message: 'statement timeout secret' }, {}, 'execution_failed'], [null, {}, 'execution_failed'],
])('failure %j options %j => %s', (error, options, category) => {
  expect(classifyQueueVacuumFailure(error, options)).toBe(category);
});

test('typed attempt failure retains only the fixed diagnosis, not a raw error', () => {
  const diagnosis = buildQueueVacuumDiagnosis(null, 'deadline');
  const error = new QueueVacuumAttemptError('secret', diagnosis);
  expect(error).toMatchObject({ name: 'QueueVacuumAttemptError', category: 'execution_failed', diagnosis });
  expect(error).not.toHaveProperty('cause');
  expect(queueVacuumFailureCategory('interrupted')).toBe('interrupted');
});

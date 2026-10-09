/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { projectEvaluationInventoryReadiness } from '../../services/evaluationInventoryReadiness.mjs';
import { inventoryProgressFixture } from '../fixtures/evaluationInventoryReadinessFixture.mjs';
const now = '2026-10-09T12:00:00Z';

test('empty queue is distinct from unfinished scans, with allowlisted aggregate output', () => {
  const row = { ...inventoryProgressFixture(), library_id: 5, run_id: 'PRIVATE', backfill_after_id: 2000 };
  expect(projectEvaluationInventoryReadiness('backfilling', row, now)).toEqual({
    version: 'evaluation_inventory_readiness.v1', status: 'backfilling', ...inventoryProgressFixture(),
    latestCheckpointAt: '2026-10-09T11:55:00.000Z' });
});

test.each(['disabled', 'waiting_for_libraries', 'ingesting', 'waiting_for_inventory', 'backfilling', 'ready'])
  ('preserves actual admission %s rather than inferring it from counts', status => {
    const row = { completedImports: 0, notStarted: 0, scanning: 0, completedHandoffs: 0,
      dueTasks: 0, processingTasks: 0, latestCheckpointAt: null };
    expect(projectEvaluationInventoryReadiness(status, row, now)).toMatchObject({ status, latestCheckpointAt: null });
  });

test.each([null, {}, { ...inventoryProgressFixture(), completedImports: 11 },
  ...['completedImports', 'notStarted', 'scanning', 'completedHandoffs', 'dueTasks', 'processingTasks']
    .flatMap(key => [-1, '1', 1.5, 2147483648].map(value => ({ ...inventoryProgressFixture(), [key]: value }))),
  ...['bad', '2026-10-09T12:01:00Z', 123].map(latestCheckpointAt => ({ ...inventoryProgressFixture(), latestCheckpointAt })),
  { ...inventoryProgressFixture(), scanning: 0, notStarted: 3 },
])('rejects invalid progress without leaking inputs', row => {
  expect(() => projectEvaluationInventoryReadiness('backfilling', row, now)).toThrow('evaluation_inventory_readiness_invalid');
});

test('invalid state, clock and contradictory ready state are not successful readiness', () => {
  expect(() => projectEvaluationInventoryReadiness('PRIVATE', inventoryProgressFixture(), now)).toThrow('invalid');
  expect(() => projectEvaluationInventoryReadiness('backfilling', inventoryProgressFixture(), 'bad')).toThrow('invalid');
  expect(() => projectEvaluationInventoryReadiness('ready', inventoryProgressFixture(), now)).toThrow('invalid');
});

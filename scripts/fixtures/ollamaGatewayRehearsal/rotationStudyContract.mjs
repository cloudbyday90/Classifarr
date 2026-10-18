/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

export function verifyRotationHistory(before, after, cycle) {
  assert.ok(Number.isInteger(cycle) && cycle >= 1 && cycle <= 3, 'rotation_cycle_invalid');
  for (const kind of ['inference', 'catalog']) {
    assert.ok(Array.isArray(before[kind]) && before[kind].length <= 16 && Array.isArray(after[kind]) && after[kind].length <= 16);
    const rows = new Map(after[kind].map(row => [row.id, row.body])); assert.equal(rows.size, after[kind].length);
    for (const row of before[kind]) assert.equal(rows.get(row.id), row.body, 'rotation_history_changed');
  }
  assert.equal(after.inference.length, 1 + cycle * 2); assert.equal(after.catalog.length, 2 + cycle * 2);
  assert.equal(after.attempts, 1 + cycle * 2); assert.equal(after.bindings, after.attempts);
  assert.deepEqual(after.catalogAttempts, Array.from({ length: cycle + 1 }, () => [2, 3]).flat());
  assert.deepEqual(after.rootCounts, { total: 2 + cycle * 2, retained: 2, retired: cycle * 2 });
  assert.equal(after.cleanupOperations, 0);
  return { cycle, inferenceJobs: after.inference.length, catalogJobs: after.catalog.length,
    retiredRoots: cycle * 2, retainedRoots: 2, attempts: after.attempts, scheduling: 'fixture_observation_only' };
}

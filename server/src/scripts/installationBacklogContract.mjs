/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

export const BACKLOG_GATE_SLEEP_MS = 8000;

export const BACKLOG_BOUNDARY = Object.freeze({ boundary: 'durable_pending_and_claimed_backfill',
  tasks: 600, gate: 'held', visibilityMs: 600000 });

export function assertBacklogBoundary(value) {
  const { remainingWindowMs, ...boundary } = value ?? {};
  assert.deepEqual(boundary, BACKLOG_BOUNDARY);
  assert.ok(Number.isSafeInteger(remainingWindowMs) && remainingWindowMs > 0 && remainingWindowMs <= BACKLOG_GATE_SLEEP_MS);
  return remainingWindowMs;
}

export function backlogRecoveryEvidence(value) {
  const fixed = { driver: 'startup_scheduler', checkpoint: 'preserved', committedIngestion: 'preserved',
    inventory: 'unchanged', taskIds: 'unchanged', profiles: 'current', movieItems: 300, tvItems: 300,
    completedTasks: 600, duplicateCompletions: 0, earlyReclaims: 0, routingTasks: 0, music: 'excluded',
    visibilityMs: 600000, siblingProgress: 'before_original_lease_expiry', databaseRestart: 'verified' };
  for (const [key, expected] of Object.entries(fixed)) assert.equal(value?.[key], expected);
  assert.ok(Number.isSafeInteger(value.interruptedTasks) && value.interruptedTasks > 0 && value.interruptedTasks < 300);
  assert.equal(value.pendingTasks, 600 - value.interruptedTasks);
  assert.equal(value.reclaimedTasks, value.interruptedTasks);
  assert.equal(value.totalStarts, 600 + value.interruptedTasks);
  assert.ok(Number.isFinite(value.observationMs) && value.observationMs > 0 && value.observationMs <= 900000);
  return { ...fixed, interruptedTasks: value.interruptedTasks, pendingTasks: value.pendingTasks,
    reclaimedTasks: value.reclaimedTasks, totalStarts: value.totalStarts, observationMs: value.observationMs };
}

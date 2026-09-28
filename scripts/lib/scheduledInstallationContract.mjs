/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

export const SCHEDULED_INSTALLATION_EXPECTED = Object.freeze({ driver: 'startup_scheduler', ingestion: 'completed',
  backfill: 'completed', profiles: 'current', deferrals: Object.freeze(['ingesting', 'backfilling']),
  movieItems: 2, tvItems: 2, music: 'excluded', routingTasks: 0 });

export function assertScheduledInstallationResult(value) {
  assert.deepEqual(value, SCHEDULED_INSTALLATION_EXPECTED);
  return value;
}

export const SCHEDULED_CRASH_BOUNDARY = Object.freeze({ boundary: 'ingestion_committed_before_backfill',
  queuedTasks: 0, refillLock: 'held' });
export const SCHEDULED_CRASH_RECOVERY = Object.freeze({ driver: 'startup_scheduler', checkpoint: 'preserved',
  ingestionRuns: 'unchanged', inventory: 'unchanged', backfill: 'completed', profiles: 'current', completedTasks: 4, routingTasks: 0 });

export function assertScheduledCrashRecovery(value) {
  assert.deepEqual(value, SCHEDULED_CRASH_RECOVERY);
  return value;
}

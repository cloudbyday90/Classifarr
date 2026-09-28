/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

export const SCHEDULED_INSTALLATION_EXPECTED = Object.freeze({ driver: 'startup_scheduler', ingestion: 'completed',
  backfill: 'completed', profiles: 'current', deferrals: Object.freeze(['ingesting', 'backfilling']),
  movieItems: 2, tvItems: 2, music: 'excluded', routingTasks: 0 });

export function assertScheduledInstallationResult(value) {
  assert.deepEqual(value, SCHEDULED_INSTALLATION_EXPECTED);
  return value;
}

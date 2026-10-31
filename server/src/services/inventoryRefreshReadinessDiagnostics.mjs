/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { descriptionRefreshDuration } from './inventoryDescriptionRefreshObservation.mjs';
import { readRepresentativeRefreshObservation, representativeFailureProperty as read } from './inventoryRepresentativeRefreshObservation.mjs';
import { INVENTORY_REFRESH_DISK_FULL, INVENTORY_REFRESH_STORAGE_CHECKS, inventoryRefreshDatabaseDiagnosis,
  inventoryRefreshSqlCategory, isInventoryRefreshDatabaseCategory } from './inventoryRefreshDatabaseFailure.mjs';

const capsules = new WeakSet();
const REMINDER_MS = 1_800_000;
const CONTINUATION = 'Automatic readiness checks continue on the existing schedule. A ready check only permits normal worker cooldown, ownership and resource checks; it does not establish storage or refresh recovery.';
const UNKNOWN_STEPS = 'If this persists, correlate this incident and time with reviewed application diagnostics. Exclude credentials, raw errors and database or provider payloads.';

/** Pure projection for the readiness wrapper; never log or change worker recovery here. */
export function createInventoryRefreshReadinessFailure(error) {
  const observation = readRepresentativeRefreshObservation(error, { consume: true });
  let category = isInventoryRefreshDatabaseCategory(observation.databaseCategory) ? observation.databaseCategory : 'unknown';
  const sqlState = inventoryRefreshSqlCategory(observation.sqlState) === category ? observation.sqlState : null;
  if (category !== 'unknown' && category !== 'database_unknown' && !sqlState) category = 'database_unknown';
  const failure = Object.freeze({ incidentId: randomUUID(), stage: 'readiness', category,
    ...(sqlState ? { sqlState } : {}),
    ...(category !== 'unknown' ? { databaseDurationMs: descriptionRefreshDuration(observation.databaseDurationMs) } : {}),
  });
  capsules.add(failure);
  return failure;
}

function safeFailure(report) {
  if (read(report, 'status') !== 'deferred' || read(report, 'reason') !== 'unavailable') return null;
  const failure = read(report, 'failure');
  if (!capsules.has(failure) || read(failure, 'stage') !== 'readiness') return null;
  const category = read(failure, 'category'), sqlState = read(failure, 'sqlState');
  if (category !== 'unknown' && !isInventoryRefreshDatabaseCategory(category)) return null;
  if (sqlState !== undefined && inventoryRefreshSqlCategory(sqlState) !== category) return null;
  if (category === INVENTORY_REFRESH_DISK_FULL && sqlState !== '53100') return null;
  return failure;
}

/** Finite-category, process-local warning bound; no timers, payload registry or recovery claim. */
export function createInventoryRefreshReadinessDiagnostics({ log, now = Date.now } = {}) {
  const reportedAt = new Map();
  return {
    report(report) {
      const failure = safeFailure(report);
      if (!failure) return;
      let time;
      try { time = now(); } catch { return; }
      if (!Number.isFinite(time) || time < 0) return;
      const previous = reportedAt.get(failure.category);
      if (previous !== undefined && time - previous < REMINDER_MS) return;
      reportedAt.set(failure.category, time);
      const diagnosis = inventoryRefreshDatabaseDiagnosis(failure.category);
      const steps = failure.category === INVENTORY_REFRESH_DISK_FULL ? INVENTORY_REFRESH_STORAGE_CHECKS : diagnosis?.steps ?? UNKNOWN_STEPS;
      try {
        Promise.resolve(log?.warn?.('Inventory refresh readiness check failed; heavy work remains deferred', {
          failure, problem: diagnosis?.problem ?? 'The preliminary readiness check failed without a trusted database diagnosis.',
          steps: `${steps} ${CONTINUATION}`, routingAffected: false,
        }, { persistStack: false })).catch(() => {}); // swallow-error: Diagnostic persistence cannot change readiness refusal or recurse into logging.
      } catch { /* A synchronous logger failure must preserve the original deferred result. */ }
    },
  };
}

/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { QUEUE_VACUUM_DIAGNOSIS_SQL } from './queueVacuumDiagnosisQuery.mjs';
import { queueVacuumFailureCategory } from './queueVacuumFailure.mjs';

const MESSAGES = Object.freeze({
  unavailable: ['Maintenance diagnosis is unavailable.', 'Review database connectivity and the recovery log; keep the existing retry limits.'],
  queue_missing: ['The queue relation could not be observed.', 'Review schema readiness before attempting maintenance.'],
  lock_interference: ['Queue locks may interfere with maintenance.', 'Review active queue maintenance or schema work before another attempt.'],
  prepared_horizon: ['Old prepared transactions may retain queue row versions.', 'Ask the transaction owner to review pending prepared transactions; do not roll them back automatically.'],
  transaction_horizon: ['Old open transactions may retain queue row versions.', 'Review hour-old open transactions with their owner; do not terminate sessions automatically.'],
  replication_horizon: ['Replication horizons may retain queue row versions.', 'Review replica health and slot ownership; do not drop slots automatically.'],
  vacuum_active: ['Queue vacuum activity was observed.', 'Allow the current vacuum to finish, then review the next pressure observation.'],
  visibility_limited: ['Database activity is only partially visible.', 'Ask an authorized database administrator to inspect maintenance blockers; do not broaden application grants.'],
  query_canceled: ['Maintenance was canceled; this does not prove a timeout.', 'Review maintenance duration and cancellation events before changing its time budget.'],
  lock_unavailable: ['Maintenance could not acquire a required lock.', 'Review concurrent queue or schema work; retain lock and retry limits.'],
  connection_lost: ['The maintenance connection was lost.', 'Review database connectivity and restart events; the attempt remains subject to cooldown.'],
  deadline: ['Maintenance exhausted its bounded session time.', 'Review database load and maintenance duration; keep automatic retry limits in place.'],
  permission_denied: ['Maintenance authority was denied.', 'Review the configured maintenance identity; do not grant broad runtime privileges.'],
  completion_unverified: ['Vacuum completion could not be verified.', 'Review PostgreSQL maintenance warnings and statistics resets before retrying.'],
  no_blocker_observed: ['No specific maintenance blocker was observed in this snapshot.', 'Compare recovery categories and pressure observations in Logs; do not assume the queue is healthy.'],
});
const FIELDS = ['retaining_transactions', 'old_transactions', 'tracking_disabled_sessions',
  'old_prepared_transactions', 'replication_horizons', 'conflicting_locks', 'waiting_locks', 'active_vacuums'];
const count = value => (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value)))
  && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;

/** Potential interference only: a catalog snapshot cannot prove the historic failure cause. */
export function buildQueueVacuumDiagnosis(row, category) {
  const failureCategory = queueVacuumFailureCategory(category);
  const evidence = Object.fromEntries(FIELDS.map(key => [key, count(row?.[key])]));
  const valid = row && Object.values(evidence).every(value => value !== null);
  const complete = valid && row.full_activity_visibility === true && evidence.tracking_disabled_sessions === 0;
  let reason = 'unavailable';
  if (valid && row.queue_present === false) reason = 'queue_missing';
  else if (valid && row.queue_present === true) {
    if (evidence.conflicting_locks > 0 || evidence.waiting_locks > 0) reason = 'lock_interference';
    else if (evidence.old_prepared_transactions > 0) reason = 'prepared_horizon';
    else if (evidence.old_transactions > 0) reason = 'transaction_horizon';
    else if (evidence.replication_horizons > 0) reason = 'replication_horizon';
    else if (evidence.active_vacuums > 0) reason = 'vacuum_active';
    else if (!complete) reason = 'visibility_limited';
    else if (['query_canceled', 'deadline', 'permission_denied', 'completion_unverified', 'lock_unavailable', 'connection_lost'].includes(failureCategory)) reason = failureCategory;
    else reason = 'no_blocker_observed';
  }
  const [message, nextStep] = MESSAGES[reason];
  return { version: 'queue.maintenance_diagnosis.v1', status: reason === 'unavailable' ? 'unavailable' : 'observed',
    failureCategory, reason, message,
    nextStep: reason === 'unavailable' ? (MESSAGES[failureCategory]?.[1] ?? nextStep) : nextStep,
    activityVisibility: complete ? 'full' : 'limited',
    evidence: valid ? evidence : null };
}

/** The caller retains the maintenance session's deadline and lock ownership. No reconnect/retry. */
export async function readQueueVacuumDiagnosis(query, category) {
  try {
    const result = await query(QUEUE_VACUUM_DIAGNOSIS_SQL, [], 3000);
    return buildQueueVacuumDiagnosis(result?.rows?.[0], category);
  } catch { return buildQueueVacuumDiagnosis(null, category); }
}

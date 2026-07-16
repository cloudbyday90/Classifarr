/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function asArray(value) {
  return Array.isArray(value?.rows) ? value.rows : [];
}

function firstRow(value) {
  return asArray(value)[0] || null;
}

export async function loadNativeIntentReconciliationLatestRun({ db }) {
  const result = await db.query(
    `SELECT run_key, run_state, source_status_id, reason_id, finished_at,
            runtime_app_version, runtime_build_revision,
            candidate_count, converted_count, already_native_count,
            deferred_count, blocked_count, failed_count
     FROM policy_native_intent_reconciliation_runs
     ORDER BY finished_at DESC, id DESC
     LIMIT 1`,
  );
  return firstRow(result);
}

export async function loadNativeIntentReconciliationUnresolvedSummary({ db }) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS unresolved_count,
            COUNT(*) FILTER (WHERE outcome_state = 'deferred_retry')::int AS deferred_retry_count,
            COUNT(*) FILTER (WHERE outcome_state = 'blocked_current_state')::int AS blocked_current_state_count,
            COUNT(*) FILTER (WHERE outcome_state = 'requires_maintenance')::int AS requires_maintenance_count,
            COUNT(*) FILTER (WHERE outcome_state = 'system_failure')::int AS system_failure_count,
            MIN(created_at) AS oldest_unresolved_at
     FROM policy_native_intent_reconciliation_states`,
  );
  return firstRow(result);
}

export async function loadNativeIntentReconciliationBlockerReasonGroups({ db, limit }) {
  const result = await db.query(
    `SELECT outcome_state, reason_id, COUNT(*)::int AS policy_count
     FROM policy_native_intent_reconciliation_states
     GROUP BY outcome_state, reason_id
     ORDER BY policy_count DESC, outcome_state ASC, reason_id ASC
     LIMIT $1`,
    [limit],
  );
  return asArray(result);
}

export async function loadNativeIntentReconciliationRecentFailedRunCount({ db, since }) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS failed_run_count
     FROM policy_native_intent_reconciliation_runs
     WHERE run_state = 'failed'
       AND finished_at >= $1`,
    [since],
  );
  return firstRow(result);
}

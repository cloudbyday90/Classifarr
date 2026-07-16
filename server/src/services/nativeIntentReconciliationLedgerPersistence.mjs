/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

async function insertNativeIntentReconciliationRun({ client, run }) {
  const result = await client.query(
    `INSERT INTO policy_native_intent_reconciliation_runs (
       run_key,
       reconciler_version,
       runtime_app_version,
       runtime_build_revision,
       run_state,
       source_status_id,
       reason_id,
       started_at,
       finished_at,
       candidate_count,
       converted_count,
       already_native_count,
       deferred_count,
       blocked_count,
       failed_count
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING id`,
    [
      run.runKey,
      run.reconcilerVersion,
      run.runtime.appVersion,
      run.runtime.buildRevision,
      run.runState,
      run.sourceStatusId,
      run.reasonId,
      run.startedAt,
      run.finishedAt,
      run.candidateCount,
      run.convertedCount,
      run.alreadyNativeCount,
      run.deferredCount,
      run.blockedCount,
      run.failedCount,
    ],
  );

  return firstRow(result)?.id ?? null;
}

async function insertNativeIntentReconciliationOutcome({ client, runId, outcome, evaluatedAt }) {
  await client.query(
    `INSERT INTO policy_native_intent_reconciliation_outcomes (
       run_id,
       policy_id,
       candidate_fingerprint,
       candidate_status_id,
       outcome_state,
       reason_id,
       retry_not_before,
       evaluated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      runId,
      outcome.policyId,
      outcome.candidateFingerprint,
      outcome.candidateStatusId,
      outcome.outcomeState,
      outcome.reasonId,
      outcome.retryNotBefore,
      evaluatedAt,
    ],
  );
}

async function tryLockNativeIntentReconciliationLedgerRetention(client, lockKey) {
  const result = await client.query(
    'SELECT pg_try_advisory_xact_lock($1) AS acquired',
    [lockKey],
  );

  return firstRow(result)?.acquired === true;
}

async function deleteExpiredNativeIntentReconciliationOutcomes({ client, cutoff, limit }) {
  const result = await client.query(
    `DELETE FROM policy_native_intent_reconciliation_outcomes
     WHERE id IN (
       SELECT id
       FROM policy_native_intent_reconciliation_outcomes
       WHERE created_at < $1::timestamptz
       ORDER BY created_at ASC, id ASC
       LIMIT $2
     )
     RETURNING id`,
    [cutoff, limit],
  );

  return Array.isArray(result?.rows) ? result.rows.map(row => row.id) : [];
}

async function deleteExpiredNativeIntentReconciliationRuns({ client, cutoff, limit }) {
  const result = await client.query(
    `DELETE FROM policy_native_intent_reconciliation_runs run
     WHERE run.id IN (
       SELECT candidate.id
       FROM policy_native_intent_reconciliation_runs candidate
       WHERE candidate.created_at < $1::timestamptz
         AND NOT EXISTS (
           SELECT 1
           FROM policy_native_intent_reconciliation_outcomes outcome
           WHERE outcome.run_id = candidate.id
         )
       ORDER BY candidate.created_at ASC, candidate.id ASC
       LIMIT $2
     )
     RETURNING run.id`,
    [cutoff, limit],
  );

  return Array.isArray(result?.rows) ? result.rows.map(row => row.id) : [];
}

export {
  deleteExpiredNativeIntentReconciliationOutcomes,
  deleteExpiredNativeIntentReconciliationRuns,
  insertNativeIntentReconciliationOutcome,
  insertNativeIntentReconciliationRun,
  tryLockNativeIntentReconciliationLedgerRetention,
};

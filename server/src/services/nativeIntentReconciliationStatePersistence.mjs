/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  buildNativeIntentAuthoritySqlPredicate,
} from './policyNativeIntentAuthorityEligibility.mjs';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePolicyIds(policyIds = []) {
  return [...new Set(asArray(policyIds)
    .map(value => Number(value))
    .filter(value => Number.isInteger(value) && value > 0))];
}

async function loadNativeIntentReconciliationStates({ db, policyIds }) {
  const ids = normalizePolicyIds(policyIds);
  if (ids.length === 0) return [];

  const result = await db.query(
    `SELECT
       policy_id,
       candidate_fingerprint,
       candidate_status_id,
       outcome_state,
       reason_id,
       retry_not_before,
       failure_count,
       evaluated_at
     FROM policy_native_intent_reconciliation_states
     WHERE policy_id = ANY($1::int[])`,
    [ids],
  );

  return asArray(result?.rows);
}

async function upsertNativeIntentReconciliationState({ client, state }) {
  const authorityPredicate = buildNativeIntentAuthoritySqlPredicate({
    intentAlias: 'active_intent',
  });
  const upserted = await client.query(
    `INSERT INTO policy_native_intent_reconciliation_states (
       policy_id,
       candidate_fingerprint,
       candidate_status_id,
       outcome_state,
       reason_id,
       retry_not_before,
       failure_count,
       evaluated_at
     )
     SELECT $1, $2, $3, $4, $5, $6, $7, $8
     WHERE NOT EXISTS (
       SELECT 1
       FROM policy_intents active_intent
       WHERE active_intent.policy_id = $1
         AND ${authorityPredicate}
     )
     ON CONFLICT (policy_id) DO UPDATE
     SET candidate_fingerprint = EXCLUDED.candidate_fingerprint,
         candidate_status_id = EXCLUDED.candidate_status_id,
         outcome_state = EXCLUDED.outcome_state,
         reason_id = EXCLUDED.reason_id,
         retry_not_before = EXCLUDED.retry_not_before,
         failure_count = EXCLUDED.failure_count,
         evaluated_at = EXCLUDED.evaluated_at,
         updated_at = NOW()
     WHERE NOT EXISTS (
       SELECT 1
       FROM policy_intents active_intent
       WHERE active_intent.policy_id = EXCLUDED.policy_id
         AND ${authorityPredicate}
     )
     RETURNING policy_id`,
    [
      state.policyId,
      state.candidateFingerprint,
      state.candidateStatusId,
      state.outcomeState,
      state.reasonId,
      state.retryNotBefore,
      state.failureCount,
      state.evaluatedAt,
    ],
  );

  // A candidate snapshot can become stale while its reconciliation batch is
  // waiting on a first-establishment transaction. Recheck after the upsert so
  // that a post-commit snapshot cannot recreate a maintenance marker.
  const cleared = await client.query(
    `DELETE FROM policy_native_intent_reconciliation_states state
     WHERE state.policy_id = $1
       AND EXISTS (
         SELECT 1
         FROM policy_intents active_intent
         WHERE active_intent.policy_id = state.policy_id
           AND ${authorityPredicate}
       )
     RETURNING state.policy_id`,
    [state.policyId],
  );

  const upsertedCount = asArray(upserted?.rows).length;
  const deletedCount = asArray(cleared?.rows).length;

  return {
    statusId: deletedCount > 0
      ? 'cleared_authoritative'
      : (upsertedCount > 0 ? 'upserted' : 'skipped_authoritative'),
    upsertedCount,
    deletedCount,
    rawPayloadExposed: false,
  };
}

async function deleteNativeIntentReconciliationStates({ client, policyIds }) {
  const ids = normalizePolicyIds(policyIds);
  if (ids.length === 0) return 0;

  const result = await client.query(
    `DELETE FROM policy_native_intent_reconciliation_states
     WHERE policy_id = ANY($1::int[])
     RETURNING policy_id`,
    [ids],
  );
  return asArray(result?.rows).length;
}

export {
  deleteNativeIntentReconciliationStates,
  loadNativeIntentReconciliationStates,
  upsertNativeIntentReconciliationState,
};

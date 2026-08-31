/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_CONTROL_KEY,
} from './policyCandidateCorrectionPolicyChangeOutcomeObservationContract.mjs';

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_TABLE =
  'policy_candidate_correction_policy_change_outcome_observations';

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

export async function acquirePolicyCandidateCorrectionPolicyChangeOutcomeObservationLock({ client } = {}) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_CONTROL_KEY,
  ]);
}

export async function readPolicyCandidateCorrectionPolicyChangeOutcomeObservation({ dbClient, lock = false } = {}) {
  const result = await dbClient.query(
    `SELECT
       hypothesis_id,
       source_intent_version,
       target_intent_version,
       baseline_window_start_at,
       baseline_window_end_at,
       followup_window_start_at,
       followup_window_end_at,
       outcome_count,
       confirmed_leader_outcome_count,
       changed_to_candidate_outcome_count,
       changed_outside_candidates_outcome_count,
       routed_not_applicable_outcome_count,
       created_at,
       expires_at
     FROM ${POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_TABLE}
     WHERE control_key = $1${lock ? ' FOR UPDATE' : ''}`,
    [POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_CONTROL_KEY],
  );
  return firstRow(result);
}

export async function findRecentPolicyCandidateCorrectionPolicyChangeReceipt({
  dbClient,
  actorId,
  notBefore,
  notAfter,
} = {}) {
  const result = await dbClient.query(
    `SELECT id, source_intent_version, target_intent_version
     FROM policy_native_intent_change_receipts
     WHERE actor_id = $1
       AND result_status_id = 'applied'
       AND created_at >= $2::timestamptz
       AND created_at <= $3::timestamptz
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [actorId, notBefore, notAfter],
  );
  return firstRow(result);
}

export async function upsertPolicyCandidateCorrectionPolicyChangeOutcomeObservation({
  client,
  observation,
} = {}) {
  const result = await client.query(
    `INSERT INTO ${POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_TABLE} (
       control_key,
       hypothesis_id,
       source_receipt_id,
       source_intent_version,
       target_intent_version,
       baseline_window_start_at,
       baseline_window_end_at,
       followup_window_start_at,
       followup_window_end_at,
       outcome_count,
       confirmed_leader_outcome_count,
       changed_to_candidate_outcome_count,
       changed_outside_candidates_outcome_count,
       routed_not_applicable_outcome_count,
       created_by_actor_id,
       created_at,
       expires_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8::timestamptz, $9::timestamptz,
       $10, $11, $12, $13, $14, $15, $16::timestamptz, $17::timestamptz
     )
     ON CONFLICT (control_key) DO UPDATE SET
       hypothesis_id = EXCLUDED.hypothesis_id,
       source_receipt_id = EXCLUDED.source_receipt_id,
       source_intent_version = EXCLUDED.source_intent_version,
       target_intent_version = EXCLUDED.target_intent_version,
       baseline_window_start_at = EXCLUDED.baseline_window_start_at,
       baseline_window_end_at = EXCLUDED.baseline_window_end_at,
       followup_window_start_at = EXCLUDED.followup_window_start_at,
       followup_window_end_at = EXCLUDED.followup_window_end_at,
       outcome_count = EXCLUDED.outcome_count,
       confirmed_leader_outcome_count = EXCLUDED.confirmed_leader_outcome_count,
       changed_to_candidate_outcome_count = EXCLUDED.changed_to_candidate_outcome_count,
       changed_outside_candidates_outcome_count = EXCLUDED.changed_outside_candidates_outcome_count,
       routed_not_applicable_outcome_count = EXCLUDED.routed_not_applicable_outcome_count,
       created_by_actor_id = EXCLUDED.created_by_actor_id,
       created_at = EXCLUDED.created_at,
       expires_at = EXCLUDED.expires_at
     WHERE ${POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_TABLE}.expires_at <= EXCLUDED.created_at
     RETURNING
       hypothesis_id,
       source_intent_version,
       target_intent_version,
       baseline_window_start_at,
       baseline_window_end_at,
       followup_window_start_at,
       followup_window_end_at,
       outcome_count,
       confirmed_leader_outcome_count,
       changed_to_candidate_outcome_count,
       changed_outside_candidates_outcome_count,
       routed_not_applicable_outcome_count,
       created_at,
       expires_at`,
    [
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_CONTROL_KEY,
      observation.hypothesisId,
      observation.sourceReceiptId,
      observation.sourceIntentVersion,
      observation.targetIntentVersion,
      observation.baselineWindow.start.toISOString(),
      observation.baselineWindow.end.toISOString(),
      observation.followupWindow.start.toISOString(),
      observation.followupWindow.end.toISOString(),
      observation.baselineSummary.outcomeCount,
      observation.baselineSummary.confirmedLeaderOutcomeCount,
      observation.baselineSummary.changedToCandidateOutcomeCount,
      observation.baselineSummary.changedOutsideCandidatesOutcomeCount,
      observation.baselineSummary.routedNotApplicableOutcomeCount,
      observation.actorId,
      observation.createdAt,
      observation.expiresAt,
    ],
  );
  return firstRow(result);
}

/** Deletes the one short-lived observation after its server-enforced expiry. */
export async function deleteExpiredPolicyCandidateCorrectionPolicyChangeOutcomeObservation({
  dbClient,
  now,
} = {}) {
  const result = await dbClient.query(
    `DELETE FROM ${POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_TABLE}
     WHERE control_key = $1
       AND expires_at <= $2::timestamptz`,
    [
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_OUTCOME_OBSERVATION_CONTROL_KEY,
      now,
    ],
  );
  return Number.isSafeInteger(result?.rowCount) ? result.rowCount : 0;
}

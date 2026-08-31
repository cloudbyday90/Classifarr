/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RECORD_CONTROL_KEY,
} from './policyCandidateCorrectionPolicyChangeDecisionRecordContract.mjs';

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RECORD_TABLE =
  'policy_candidate_correction_policy_change_decision_records';

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

export async function readPolicyCandidateCorrectionPolicyChangeDecisionRecord({ dbClient, lock = false } = {}) {
  const result = await dbClient.query(
    `SELECT
       observation_hypothesis_id,
       decision_id,
       rationale_id,
       revision,
       created_at,
       updated_at,
       expires_at
     FROM ${POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RECORD_TABLE}
     WHERE control_key = $1${lock ? ' FOR UPDATE' : ''}`,
    [POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RECORD_CONTROL_KEY],
  );
  return firstRow(result);
}

export async function insertPolicyCandidateCorrectionPolicyChangeDecisionRecord({ client, record } = {}) {
  const result = await client.query(
    `INSERT INTO ${POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RECORD_TABLE} (
       control_key,
       observation_hypothesis_id,
       decision_id,
       rationale_id,
       revision,
       created_by_actor_id,
       updated_by_actor_id,
       created_at,
       updated_at,
       expires_at
     ) VALUES ($1, $2, $3, $4, 1, $5, $5, $6::timestamptz, $6::timestamptz, $7::timestamptz)
     RETURNING
       observation_hypothesis_id,
       decision_id,
       rationale_id,
       revision,
       created_at,
       updated_at,
       expires_at`,
    [
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RECORD_CONTROL_KEY,
      record.observationHypothesisId,
      record.decisionId,
      record.rationaleId,
      record.actorId,
      record.now,
      record.expiresAt,
    ],
  );
  return firstRow(result);
}

export async function updatePolicyCandidateCorrectionPolicyChangeDecisionRecord({
  client,
  record,
  expectedRevision,
} = {}) {
  const result = await client.query(
    `UPDATE ${POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RECORD_TABLE}
     SET decision_id = $1,
         rationale_id = $2,
         revision = revision + 1,
         updated_by_actor_id = $3,
         updated_at = $4::timestamptz
     WHERE control_key = $5
       AND observation_hypothesis_id = $6
       AND revision = $7
       AND expires_at > $4::timestamptz
     RETURNING
       observation_hypothesis_id,
       decision_id,
       rationale_id,
       revision,
       created_at,
       updated_at,
       expires_at`,
    [
      record.decisionId,
      record.rationaleId,
      record.actorId,
      record.now,
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RECORD_CONTROL_KEY,
      record.observationHypothesisId,
      expectedRevision,
    ],
  );
  return firstRow(result);
}

/** Deletes decision data first so it can never outlive a removed observation. */
export async function deleteExpiredPolicyCandidateCorrectionPolicyChangeDecisionRecord({ dbClient, now } = {}) {
  const result = await dbClient.query(
    `DELETE FROM ${POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RECORD_TABLE}
     WHERE control_key = $1
       AND expires_at <= $2::timestamptz`,
    [
      POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_RECORD_CONTROL_KEY,
      now,
    ],
  );
  return Number.isSafeInteger(result?.rowCount) ? result.rowCount : 0;
}

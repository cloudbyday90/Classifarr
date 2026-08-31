/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_IDS,
} from './policyCandidateCorrectionPolicyChangeDecisionRecordContract.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_ACTIVITY_IDS,
  POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_SUMMARY_CONTROL_KEY,
  getPolicyCandidateCorrectionPolicyChangeReviewHistoryPeriodStart,
} from './policyCandidateCorrectionPolicyChangeReviewHistorySummaryContract.mjs';

export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_SUMMARY_CONTROL_TABLE =
  'policy_change_review_history_controls';
export const POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_SUMMARY_TABLE =
  'policy_change_review_history_aggregates';

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

/** Reads only the collection boundary, never an actor or a decision record. */
export async function readPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryControl({ dbClient } = {}) {
  const result = await dbClient.query(
    `SELECT started_at
     FROM ${POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_SUMMARY_CONTROL_TABLE}
     WHERE control_key = $1`,
    [POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_SUMMARY_CONTROL_KEY],
  );
  return firstRow(result);
}

/** Reads server-selected periods only; callers cannot add dimensions or ranges. */
export async function readPolicyCandidateCorrectionPolicyChangeReviewHistoryAggregates({
  dbClient,
  periodStarts = [],
} = {}) {
  if (!Array.isArray(periodStarts) || periodStarts.length === 0) return [];
  const result = await dbClient.query(
    `SELECT period_start, decision_id, recorded_count, revised_count
     FROM ${POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_SUMMARY_TABLE}
     WHERE period_start = ANY($1::date[])
     ORDER BY period_start DESC, decision_id ASC`,
    [periodStarts],
  );
  return Array.isArray(result?.rows) ? result.rows : [];
}

/** Atomically increments one fixed activity bucket without retaining an event. */
export async function recordPolicyCandidateCorrectionPolicyChangeReviewHistoryActivity({
  client,
  decisionId,
  activityId,
  now,
} = {}) {
  const periodStart = getPolicyCandidateCorrectionPolicyChangeReviewHistoryPeriodStart(now);
  const recordedIncrement = activityId === POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_ACTIVITY_IDS.RECORDED
    ? 1
    : 0;
  const revisedIncrement = activityId === POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_ACTIVITY_IDS.REVISED
    ? 1
    : 0;
  if (!periodStart || !POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_DECISION_IDS.includes(decisionId) ||
      recordedIncrement + revisedIncrement !== 1) {
    throw new TypeError('Policy-change review history activity is invalid.');
  }

  await client.query(
    `INSERT INTO ${POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_SUMMARY_TABLE} (
       period_start,
       decision_id,
       recorded_count,
       revised_count
     ) VALUES ($1::date, $2, $3, $4)
     ON CONFLICT (period_start, decision_id) DO UPDATE
     SET recorded_count = ${POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_SUMMARY_TABLE}.recorded_count + EXCLUDED.recorded_count,
         revised_count = ${POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_SUMMARY_TABLE}.revised_count + EXCLUDED.revised_count`,
    [periodStart, decisionId, recordedIncrement, revisedIncrement],
  );
}

export async function deleteExpiredPolicyCandidateCorrectionPolicyChangeReviewHistoryAggregates({
  dbClient,
  beforePeriodStart,
} = {}) {
  const result = await dbClient.query(
    `DELETE FROM ${POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_SUMMARY_TABLE}
     WHERE period_start < $1::date`,
    [beforePeriodStart],
  );
  return Number.isSafeInteger(result?.rowCount) ? result.rowCount : 0;
}

/** A restore starts a fresh aggregate collection period and retains no prior activity. */
export async function resetPolicyCandidateCorrectionPolicyChangeReviewHistorySummaryForRestore({
  client,
  now = new Date(),
} = {}) {
  await client.query('DELETE FROM policy_change_review_history_aggregates');
  await client.query(
    `UPDATE ${POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_SUMMARY_CONTROL_TABLE}
     SET started_at = $1::timestamptz
     WHERE control_key = $2`,
    [now instanceof Date ? now.toISOString() : now, POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_SUMMARY_CONTROL_KEY],
  );
}

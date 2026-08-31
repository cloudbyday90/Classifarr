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
  POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS,
  POLICY_CANDIDATE_CORRECTION_EVIDENCE_STATE_IDS,
  POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER,
} from './policyCandidateCorrectionSignalSnapshot.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_OUTCOME_ATTRIBUTION_VERSION,
} from './policyCandidateCorrectionOutcomeAttribution.mjs';
import {
  POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS,
} from './policyRuntimeCandidateSetSelectionOutcome.mjs';

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_TABLE =
  'policy_candidate_correction_review_projections';
export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_ITEM_TABLE =
  'policy_candidate_correction_review_projection_items';
export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_AUDIT_EVENT_TABLE =
  'policy_candidate_correction_review_projection_audit_events';

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

export async function acquirePolicyCandidateCorrectionRepresentativeReviewProjectionLock({ client, lockKey } = {}) {
  await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [lockKey]);
}

export async function findActivePolicyCandidateCorrectionRepresentativeReviewProjection({
  dbClient,
  configurationRevision,
  now,
  lock = false,
} = {}) {
  const result = await dbClient.query(
    `SELECT
       snapshot_id,
       purpose_id,
       configuration_revision,
       previous_window_start_at,
       previous_window_end_at,
       current_window_start_at,
       current_window_end_at,
       sample_per_stratum,
       item_count,
       created_at,
       expires_at
     FROM ${POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_TABLE}
     WHERE configuration_revision = $1
       AND expires_at > $2::timestamptz
     ORDER BY created_at DESC, snapshot_id DESC
     LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [configurationRevision, now],
  );
  return firstRow(result);
}

export async function listPolicyCandidateCorrectionRepresentativeReviewProjectionItems({ dbClient, snapshotId } = {}) {
  const result = await dbClient.query(
    `SELECT ordinal, period_id, score_margin_band_id, selection_status_id, evidence_source_states
     FROM ${POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_ITEM_TABLE}
     WHERE snapshot_id = $1
     ORDER BY ordinal ASC`,
    [snapshotId],
  );
  return Array.isArray(result?.rows) ? result.rows : [];
}

export async function insertPolicyCandidateCorrectionRepresentativeReviewProjection({
  client,
  projection,
} = {}) {
  const result = await client.query(
    `INSERT INTO ${POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_TABLE} (
       snapshot_id,
       purpose_id,
       configuration_revision,
       previous_window_start_at,
       previous_window_end_at,
       current_window_start_at,
       current_window_end_at,
       sample_per_stratum,
       item_count,
       created_by_actor_id,
       created_at,
       expires_at
     ) VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6::timestamptz, $7::timestamptz, $8, 0, $9, $10::timestamptz, $11::timestamptz)
     RETURNING
       snapshot_id,
       purpose_id,
       configuration_revision,
       previous_window_start_at,
       previous_window_end_at,
       current_window_start_at,
       current_window_end_at,
       sample_per_stratum,
       item_count,
       created_at,
       expires_at`,
    [
      projection.snapshotId,
      projection.purposeId,
      projection.configurationRevision,
      projection.previousWindow.start.toISOString(),
      projection.previousWindow.end.toISOString(),
      projection.currentWindow.start.toISOString(),
      projection.currentWindow.end.toISOString(),
      projection.samplePerStratum,
      projection.actorId,
      projection.createdAt,
      projection.expiresAt,
    ],
  );
  return firstRow(result);
}

/**
 * Selects only the fixed, content-free attribution dimensions while still in
 * PostgreSQL. `classification_history.id` is used solely to randomize the
 * server-owned sample order and is never returned, persisted, or serialized.
 */
export async function insertPolicyCandidateCorrectionRepresentativeReviewProjectionItems({
  client,
  snapshotId,
  previousWindow,
  currentWindow,
  sampleSeed,
  samplePerStratum,
} = {}) {
  const result = await client.query(
    `WITH eligible AS (
       SELECT
         CASE WHEN ch.created_at >= $3::timestamptz THEN 'current' ELSE 'previous' END AS period_id,
         ch.metadata #>> '{classification_details,policy_candidate_correction_outcome_attribution,score_margin_band_id}' AS score_margin_band_id,
         ch.metadata #>> '{classification_details,policy_candidate_correction_outcome_attribution,selection_status_id}' AS selection_status_id,
         sanitized.evidence_source_states,
         md5($10::text || ':' || ch.id::text) AS sample_order
       FROM classification_history AS ch
       CROSS JOIN LATERAL (
         SELECT
           jsonb_agg(
             jsonb_build_object(
               'source_id', source_state ->> 'source_id',
               'state_id', source_state ->> 'state_id'
             )
             ORDER BY array_position($8::text[], source_state ->> 'source_id')
           ) AS evidence_source_states,
           COUNT(*)::integer AS source_state_count,
           COUNT(DISTINCT source_state ->> 'source_id')::integer AS unique_source_count,
           COALESCE(
             bool_and(
               source_state ->> 'source_id' = ANY($8::text[])
               AND source_state ->> 'state_id' = ANY($9::text[])
             ),
             false
           ) AS has_only_allow_listed_states
         FROM jsonb_array_elements(
           CASE
             WHEN jsonb_typeof(ch.metadata #> '{classification_details,policy_candidate_correction_outcome_attribution,evidence_source_states}') = 'array'
               THEN ch.metadata #> '{classification_details,policy_candidate_correction_outcome_attribution,evidence_source_states}'
             ELSE '[]'::jsonb
           END
         ) AS source_state
       ) AS sanitized
       WHERE ch.created_at >= $2::timestamptz
         AND ch.created_at < $4::timestamptz
         AND ch.metadata #>> '{classification_details,policy_candidate_correction_outcome_attribution,version}' = $5
         AND ch.metadata #>> '{classification_details,policy_candidate_correction_outcome_attribution,score_margin_band_id}' = ANY($6::text[])
         AND ch.metadata #>> '{classification_details,policy_candidate_correction_outcome_attribution,selection_status_id}' = ANY($7::text[])
         AND sanitized.source_state_count = array_length($8::text[], 1)
         AND sanitized.unique_source_count = array_length($8::text[], 1)
         AND sanitized.has_only_allow_listed_states = true
     ), ranked AS (
       SELECT
         period_id,
         score_margin_band_id,
         selection_status_id,
         evidence_source_states,
         ROW_NUMBER() OVER (
           PARTITION BY period_id, score_margin_band_id, selection_status_id
           ORDER BY sample_order ASC
         ) AS stratum_rank
       FROM eligible
     ), sampled AS (
       SELECT period_id, score_margin_band_id, selection_status_id, evidence_source_states
       FROM ranked
       WHERE stratum_rank <= $11
     ), numbered AS (
       SELECT
         ROW_NUMBER() OVER (
           ORDER BY period_id ASC, score_margin_band_id ASC, selection_status_id ASC, evidence_source_states::text ASC
         )::integer AS ordinal,
         period_id,
         score_margin_band_id,
         selection_status_id,
         evidence_source_states
       FROM sampled
     )
     INSERT INTO ${POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_ITEM_TABLE} (
       snapshot_id, ordinal, period_id, score_margin_band_id, selection_status_id, evidence_source_states
     )
     SELECT $1, ordinal, period_id, score_margin_band_id, selection_status_id, evidence_source_states
     FROM numbered`,
    [
      snapshotId,
      previousWindow.start.toISOString(),
      currentWindow.start.toISOString(),
      currentWindow.end.toISOString(),
      POLICY_CANDIDATE_CORRECTION_OUTCOME_ATTRIBUTION_VERSION,
      POLICY_CANDIDATE_CORRECTION_MARGIN_BAND_ORDER,
      Object.values(POLICY_RUNTIME_CANDIDATE_SET_SELECTION_STATUS_IDS),
      POLICY_CANDIDATE_CORRECTION_EVIDENCE_SOURCE_IDS,
      POLICY_CANDIDATE_CORRECTION_EVIDENCE_STATE_IDS,
      sampleSeed,
      samplePerStratum,
    ],
  );
  return Number(result?.rowCount) || 0;
}

export async function setPolicyCandidateCorrectionRepresentativeReviewProjectionItemCount({
  client,
  snapshotId,
  itemCount,
} = {}) {
  const result = await client.query(
    `UPDATE ${POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_TABLE}
     SET item_count = $2
     WHERE snapshot_id = $1
     RETURNING
       snapshot_id,
       purpose_id,
       configuration_revision,
       previous_window_start_at,
       previous_window_end_at,
       current_window_start_at,
       current_window_end_at,
       sample_per_stratum,
       item_count,
       created_at,
       expires_at`,
    [snapshotId, itemCount],
  );
  return firstRow(result);
}

export async function insertPolicyCandidateCorrectionRepresentativeReviewProjectionAuditEvent({
  client,
  event,
} = {}) {
  const result = await client.query(
    `INSERT INTO ${POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_AUDIT_EVENT_TABLE} (
       event_version,
       action_id,
       actor_id,
       projection_created_at,
       configuration_revision,
       item_count,
       occurred_at
     ) VALUES ($1, $2, $3, $4::timestamptz, $5, $6, $7::timestamptz)
     RETURNING id`,
    [
      1,
      event.actionId,
      event.actorId,
      event.projectionCreatedAt,
      event.configurationRevision,
      event.itemCount,
      event.occurredAt,
    ],
  );
  return firstRow(result);
}

export async function tryLockPolicyCandidateCorrectionRepresentativeReviewProjectionRetention({ client, lockKey } = {}) {
  const result = await client.query('SELECT pg_try_advisory_xact_lock($1::bigint) AS acquired', [lockKey]);
  return firstRow(result)?.acquired === true;
}

export async function lockExpiredPolicyCandidateCorrectionRepresentativeReviewProjections({ client, now, limit } = {}) {
  const result = await client.query(
    `SELECT snapshot_id, configuration_revision, item_count, created_at
     FROM ${POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_TABLE}
     WHERE expires_at <= $1::timestamptz
     ORDER BY expires_at ASC, snapshot_id ASC
     LIMIT $2
     FOR UPDATE SKIP LOCKED`,
    [now, limit],
  );
  return Array.isArray(result?.rows) ? result.rows : [];
}

export async function deletePolicyCandidateCorrectionRepresentativeReviewProjection({ client, snapshotId } = {}) {
  const result = await client.query(
    `DELETE FROM ${POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PROJECTION_TABLE}
     WHERE snapshot_id = $1
     RETURNING snapshot_id`,
    [snapshotId],
  );
  return firstRow(result);
}

/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_TABLE =
  'policy_candidate_correction_review_corpus_captures';
export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_AUDIT_EVENT_TABLE =
  'policy_candidate_correction_review_corpus_capture_audit_events';

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

export async function insertPolicyCandidateCorrectionRepresentativeReviewCorpusCapture({
  client,
  capture,
} = {}) {
  const result = await client.query(
    `INSERT INTO ${POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_TABLE} (
       capture_id,
       capture_version,
       purpose_id,
       configuration_revision,
       score_margin_band_id,
       selection_status_id,
       evidence_source_states,
       captured_by_actor_id,
       captured_at,
       expires_at
     ) VALUES ($1, 1, $2, $3, $4, $5, $6::jsonb, $7, $8::timestamptz, $9::timestamptz)
     RETURNING capture_id, configuration_revision, captured_at, expires_at`,
    [
      capture.captureId,
      capture.purposeId,
      capture.configurationRevision,
      capture.scoreMarginBandId,
      capture.selectionStatusId,
      JSON.stringify(capture.evidenceSourceStates),
      capture.actorId,
      capture.capturedAt,
      capture.expiresAt,
    ],
  );
  return firstRow(result);
}

export async function insertPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureAuditEvent({
  client,
  event,
} = {}) {
  const result = await client.query(
    `INSERT INTO ${POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_AUDIT_EVENT_TABLE} (
       event_version,
       action_id,
       actor_id,
       capture_id,
       capture_recorded_at,
       configuration_revision,
       occurred_at
     ) VALUES (1, $1, $2, $3, $4::timestamptz, $5, $6::timestamptz)
     RETURNING id`,
    [
      event.actionId,
      event.actorId,
      event.captureId,
      event.captureRecordedAt,
      event.configurationRevision,
      event.occurredAt,
    ],
  );
  return firstRow(result);
}

export async function tryLockPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureRetention({
  client,
  lockKey,
} = {}) {
  const result = await client.query('SELECT pg_try_advisory_xact_lock($1::bigint) AS acquired', [lockKey]);
  return firstRow(result)?.acquired === true;
}

export async function lockExpiredPolicyCandidateCorrectionRepresentativeReviewCorpusCaptures({
  client,
  now,
  limit,
} = {}) {
  const result = await client.query(
    `SELECT capture_id, configuration_revision, captured_at
     FROM ${POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_TABLE}
     WHERE expires_at <= $1::timestamptz
     ORDER BY expires_at ASC, capture_id ASC
     LIMIT $2
     FOR UPDATE SKIP LOCKED`,
    [now, limit],
  );
  return Array.isArray(result?.rows) ? result.rows : [];
}

export async function deletePolicyCandidateCorrectionRepresentativeReviewCorpusCapture({
  client,
  captureId,
} = {}) {
  const result = await client.query(
    `DELETE FROM ${POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_TABLE}
     WHERE capture_id = $1
     RETURNING capture_id`,
    [captureId],
  );
  return firstRow(result);
}

/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalDatabaseBigintId } from './databaseIntegerValues.mjs';
import { readFeedbackReviewOutcomeSnapshot } from './feedbackReviewOutcomeSnapshot.mjs';
import { buildPurposeOutcomeReference, purposeOutcomeTime } from './purposeOutcomeReference.mjs';

async function persist(client, context) {
  const classificationId = canonicalDatabaseBigintId(context.classificationId);
  const observed = purposeOutcomeTime(context.observedAt), now = purposeOutcomeTime(context.now);
  if (!classificationId || !['movie', 'tv'].includes(context.mediaType) || !Number.isFinite(observed) ||
      !Number.isFinite(now) || observed > now || now - observed >= 30 * 86400000) return false;
  context.classificationId = classificationId;
  // Existing canonical events are never improved by a later tier receipt or late source write.
  if ((await client.query('SELECT event_key FROM policy_purpose_outcome_supplements WHERE event_key=$1', [context.eventKey])).rows.length) return false;
  const capture = (await client.query(`SELECT classification_id::text, capture_version, media_type, identity_key,
    observed_at, expires_at, expired_at, reason_id,
    CASE WHEN octet_length(payload::text)<=65536 THEN payload END AS payload
    FROM classification_policy_evaluation_captures WHERE classification_id=$1 FOR SHARE`, [classificationId])).rows[0];
  const reference = buildPurposeOutcomeReference(capture, context, now);
  const result = await client.query(`INSERT INTO policy_purpose_outcome_supplements
    (event_key,classification_id,authorized_receipt_id,feedback_classification_id,source_kind,action_reference,
      media_type,identity_key,selected_library_id,action_kind,observed_at,frozen_at,expires_at,reason_id,payload)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
    ON CONFLICT(event_key) DO NOTHING RETURNING event_key`, [context.eventKey, classificationId,
    context.receiptId ?? null, context.feedbackId ?? null, context.sourceKind, context.actionReference,
    context.mediaType, context.identityKey, context.selectedLibraryId, context.actionKind,
    context.observedAt, context.now, reference.expiresAt, reference.reason, reference.payload]);
  return result.rowCount === 1;
}

/** Called only after a newly validated canonical snapshot, in the existing effects transaction. */
export async function captureAuthorizedPurposeOutcome(client, receiptId) {
  const row = (await client.query(`SELECT r.id::text AS receipt_id,r.classification_id::text,s.media_type,s.identity_key,
    s.selected_library_id,s.action_kind,s.observed_at,s.event_key,r.source_id,transaction_timestamp() AS now,
    EXISTS(SELECT 1 FROM policy_authorized_outcome_source_event_receipts prior
      WHERE r.source_id='operator_confirmation' AND prior.source_id=r.source_id AND prior.classification_id=r.classification_id
        AND prior.id<r.id AND split_part(prior.source_event_id,':',3)=split_part(r.source_event_id,':',3)
        AND prior.final_outcome_status_id IN ('resolved','routed')) AS prior_alias
    FROM policy_authorized_outcome_source_event_receipts r JOIN policy_authorized_outcome_evaluation_snapshots s ON s.receipt_id=r.id
    WHERE r.id=$1 AND s.snapshot_version=1 AND s.selected_library_id=r.destination_library_id
      AND r.source_id IN ('operator_confirmation','manual_classification_change')
      AND r.final_outcome_status_id IN ('resolved','routed')`, [receiptId])).rows[0];
  if (!row) return false;
  const manual = row.source_id === 'manual_classification_change';
  return persist(client, { classificationId: row.classification_id, receiptId: row.receipt_id,
    sourceKind: manual ? 'manual' : 'runtime', actionReference: manual ? 'manual_prior_destination' : 'runtime_answer_contract',
    mediaType: row.media_type, identityKey: row.identity_key, selectedLibraryId: row.selected_library_id,
    actionKind: row.action_kind, eventKey: row.event_key, observedAt: row.observed_at, now: row.now, priorAlias: row.prior_alias });
}

/** Legacy selections never create purpose supplements. Explicit v3 reviews already own one atomic receipt. */
export async function captureFeedbackPurposeOutcome(client, classificationId) {
  const row = (await client.query(`SELECT classification_id::text,intake,created_at,transaction_timestamp() AS now,
    CASE WHEN octet_length(outcome_snapshot::text)<=4096 THEN outcome_snapshot END AS snapshot
    FROM policy_feedback_sources WHERE classification_id=$1`, [classificationId])).rows[0];
  const snapshot = readFeedbackReviewOutcomeSnapshot(row?.snapshot);
  if (!snapshot || row.intake !== 'standalone' || snapshot.classificationId !== row.classification_id) return false;
  return persist(client, { classificationId: row.classification_id, feedbackId: row.classification_id,
    sourceKind: 'history_review', actionReference: 'original_automated_destination', mediaType: snapshot.mediaType,
    identityKey: `${snapshot.mediaType}:${snapshot.tmdbId}`, selectedLibraryId: snapshot.selectedLibraryId,
    actionKind: snapshot.action, eventKey: `feedback_review:${row.classification_id}`, observedAt: row.created_at, now: row.now });
}

export async function prunePurposeOutcomeSupplements(client) {
  const result = await client.query(`UPDATE policy_purpose_outcome_supplements
    SET payload=NULL,identity_key=NULL,selected_library_id=NULL,action_kind=NULL,expired_at=NOW()
    WHERE event_key IN (SELECT event_key FROM policy_purpose_outcome_supplements
      WHERE expired_at IS NULL AND expires_at<=NOW() ORDER BY expires_at,event_key LIMIT 1000 FOR UPDATE SKIP LOCKED)`);
  return result.rowCount;
}

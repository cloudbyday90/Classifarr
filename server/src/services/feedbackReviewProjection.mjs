/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readClassificationDestinationDecision } from './classificationDestinationDecision.mjs';
import { CLASSIFIER_CAPTURE_METHODS } from './classificationCandidateCapture.mjs';
import { safeParseJsonObject } from '../utils/classificationRetryPayloads.mjs';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { feedbackReviewHash, feedbackReviewId, feedbackReviewChanged } from './feedbackReviewContract.mjs';

export function projectFeedbackReviewSource(row) {
  const capture = readClassificationDestinationDecision(safeParseJsonObject(row?.metadata).classification_details?.destination_decision);
  const created = row?.created_at instanceof Date ? row.created_at.getTime() : Date.parse(row?.created_at);
  if (!row || !['completed', 'verified', 'routed'].includes(row.status) || !capture || capture.status !== 'completed' ||
      !CLASSIFIER_CAPTURE_METHODS.includes(row.method) || capture.method !== row.method ||
      capture.mediaType !== row.media_type || !capture.tmdbId || capture.tmdbId !== positiveDatabaseInteger(row.tmdb_id) ||
      typeof row.review_revision !== 'string' || !/^[0-9]+$/.test(row.review_revision) ||
      typeof row.title !== 'string' || row.title.length > 500 || !Number.isFinite(created) || created > Date.now()) throw feedbackReviewChanged();
  const id = feedbackReviewId(row.id);
  return { id, capture, sourceVersion: feedbackReviewHash(['feedback.review.source.v1', id, row.review_revision,
    row.media_type, row.tmdb_id, row.method, row.status, capture]),
  item: { classificationId: id, mediaType: row.media_type, tmdbId: capture.tmdbId, title: row.title,
    currentOutcome: typeof row.library_name === 'string' ? row.library_name.slice(0, 255) : null } };
}

export function buildFeedbackReviewProjection(source, choices) {
  if (!choices.length || choices.length > 128) throw feedbackReviewChanged();
  const options = choices.map(row => ({ libraryId: row.library_id, libraryName: row.library_name,
    policyId: row.policy_id, policyName: row.policy_name, libraryRevision: row.library_revision, policyRevision: row.policy_revision }));
  const reference = options.find(option => option.libraryId === source.capture.libraryId);
  if (!reference) throw feedbackReviewChanged();
  const projection = { item: source.item, capture: source.capture, sourceVersion: source.sourceVersion,
    reference: { kind: 'original_automated_destination', libraryId: reference.libraryId,
      libraryName: reference.libraryName, libraryRevision: reference.libraryRevision }, choices: options };
  // Leave space for jsonb's canonical separators within the database's 64 KiB bound.
  if (Buffer.byteLength(JSON.stringify(projection)) > 60000) throw feedbackReviewChanged();
  return projection;
}

export function publicFeedbackReview(row) {
  const value = row.projection;
  return { version: 'feedback.review.v1', reviewId: row.id, issuedAt: row.created_at.toISOString(), expiresAt: row.expires_at.toISOString(),
    item: value.item, reference: { kind: value.reference.kind, libraryId: value.reference.libraryId, libraryName: value.reference.libraryName },
    choices: value.choices.map(({ libraryId, libraryName, policyId, policyName }) => ({ libraryId, libraryName, policyId, policyName })) };
}

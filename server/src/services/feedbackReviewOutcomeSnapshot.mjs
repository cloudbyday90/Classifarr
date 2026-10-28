/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalDatabaseBigintId } from './databaseIntegerValues.mjs';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { CLASSIFIER_CAPTURE_METHODS } from './classificationCandidateCapture.mjs';
import { readCorrectionDecisionContext, captureCorrectionDecisionContext } from './classificationDestinationDecision.mjs';
import { feedbackReviewExact, feedbackReviewUuid, feedbackReviewTime, FEEDBACK_REVIEW_TTL_MS } from './feedbackReviewContract.mjs';

export const FEEDBACK_REVIEW_SNAPSHOT_VERSION = 'classification.feedback_outcome.v3';
const integer = value => typeof value === 'number' && positiveDatabaseInteger(value) !== null;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function readFeedbackReviewOutcomeSnapshot(value) {
  if (!feedbackReviewExact(value, ['version', 'classificationId', 'mediaType', 'tmdbId', 'selectedLibraryId', 'decisionContext', 'action', 'intake', 'reference']) ||
      value.version !== FEEDBACK_REVIEW_SNAPSHOT_VERSION || typeof value.classificationId !== 'string' ||
      canonicalDatabaseBigintId(value.classificationId) !== value.classificationId || !['movie', 'tv'].includes(value.mediaType) ||
      !integer(value.tmdbId) || !integer(value.selectedLibraryId) || !['confirmation', 'correction'].includes(value.action) || value.intake !== 'standalone') return null;
  const ref = value.reference;
  if (!feedbackReviewExact(ref, ['kind', 'libraryId', 'reviewId', 'actorFingerprint', 'sourceVersion', 'issuedAt', 'expiresAt']) ||
      ref.kind !== 'original_automated_destination' || !integer(ref.libraryId) || !feedbackReviewUuid(ref.reviewId) ||
      !hash(ref.actorFingerprint) || !hash(ref.sourceVersion) || !feedbackReviewTime(ref.issuedAt) || !feedbackReviewTime(ref.expiresAt) ||
      Date.parse(ref.expiresAt) - Date.parse(ref.issuedAt) !== FEEDBACK_REVIEW_TTL_MS ||
      (value.action === 'confirmation') !== (value.selectedLibraryId === ref.libraryId)) return null;
  const context = value.decisionContext === null ? null : readCorrectionDecisionContext(value.decisionContext);
  if (value.decisionContext !== null && (!context || String(context.classificationId) !== value.classificationId ||
      context.capture.mediaType !== value.mediaType || context.capture.tmdbId !== value.tmdbId ||
      context.capture.status !== 'completed' || context.capture.libraryId !== ref.libraryId ||
      !CLASSIFIER_CAPTURE_METHODS.includes(context.capture.method))) return null;
  return { ...value, decisionContext: context, reference: { ...ref } };
}
export function buildFeedbackReviewOutcomeSnapshot(classification, destination, action, reference, actorFingerprint) {
  return readFeedbackReviewOutcomeSnapshot({ version: FEEDBACK_REVIEW_SNAPSHOT_VERSION,
    classificationId: canonicalDatabaseBigintId(classification.id), mediaType: classification.media_type,
    tmdbId: positiveDatabaseInteger(classification.tmdb_id), selectedLibraryId: destination,
    decisionContext: captureCorrectionDecisionContext(classification), action, intake: 'standalone', reference: {
      kind: 'original_automated_destination', libraryId: reference.projection.reference.libraryId, reviewId: reference.id,
      actorFingerprint, sourceVersion: reference.projection.sourceVersion,
      issuedAt: reference.created_at.toISOString(), expiresAt: reference.expires_at.toISOString() } });
}

/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { exactQualityKeys as exact, qualityHash } from './sourcePairQualityContract.mjs';
import { qualityEvidenceHash, qualityEvidenceTime } from './qualityEvidenceContract.mjs';
import { orderedQualityReviewRows, qualityReviewerId, qualityReviewProvenance, requireQualityReviewTime } from './qualityReviewBinding.mjs';

const keys = ['version', 'protocolId', 'packetDigest', 'reviewerId', 'submissionId', 'createdAt', 'expiresAt',
  'provenance', 'independentReviewConfirmed', 'parentReviews', 'labels'];

export function validQualityReviewDocument(value, context, { finalized = false, cases = context.cases, parentReviews = null,
  earliest = context.protocol.createdAt, now } = {}) {
  if (!exact(value, finalized ? [...keys, 'submittedAt'] : keys) ||
      value.version !== (finalized ? 'quality_review_submission.v1' : 'quality_review_template.v1') ||
      value.protocolId !== context.protocol.id || value.packetDigest !== context.packetDigest ||
      !qualityReviewerId(value.reviewerId) || !qualityEvidenceHash(value.submissionId) || !qualityReviewProvenance(value.provenance) ||
      typeof value.independentReviewConfirmed !== 'boolean' || value.parentReviews !== parentReviews ||
      !qualityEvidenceTime(value.createdAt) || !qualityEvidenceTime(now) || value.expiresAt !== context.expiresAt ||
      Date.parse(value.createdAt) < Date.parse(earliest) || Date.parse(value.createdAt) > Date.parse(now) ||
      Date.parse(value.createdAt) >= Date.parse(context.expiresAt) ||
      !Array.isArray(value.labels) || value.labels.length !== cases.length) return false;
  if (finalized && (!qualityEvidenceTime(value.submittedAt) || Date.parse(value.submittedAt) < Date.parse(value.createdAt) ||
      Date.parse(value.submittedAt) >= Date.parse(context.expiresAt) || Date.parse(value.submittedAt) > Date.parse(now) ||
      value.independentReviewConfirmed !== (value.provenance === 'independent_human.v1'))) return false;
  const remaining = new Map(cases.map(row => [row.item, row.mediaType]));
  return value.labels.every(row => exact(row, ['item', 'mediaType', 'target']) && remaining.get(row.item) === row.mediaType &&
    remaining.delete(row.item) && (row.target === null || context.targets.get(row.target) === row.mediaType));
}

export function readQualityReviewSubmission(value, context, options) {
  requireQualityReviewTime(context, options.now);
  if (!validQualityReviewDocument(value, context, { ...options, finalized: true })) throw new Error('quality_review_submission_invalid');
  return new Map(value.labels.map(row => [row.item, row.target]));
}

/** Canonical input binding survives JSON formatting/reordering, not substantive edits. */
export function qualityReviewSubmissionDigest(value) {
  return qualityHash([value.version, value.protocolId, value.packetDigest, value.reviewerId, value.submissionId,
    value.createdAt, value.expiresAt, value.submittedAt, value.provenance, value.independentReviewConfirmed, value.parentReviews,
    orderedQualityReviewRows(value.labels).map(row => [row.item, row.mediaType, row.target])]);
}

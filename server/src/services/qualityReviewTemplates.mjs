/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomBytes } from 'node:crypto';
import { qualityReviewContext, qualityReviewerId, qualityReviewProvenance, orderedQualityReviewRows, requireQualityReviewTime } from './qualityReviewBinding.mjs';
import { validQualityReviewDocument, readQualityReviewSubmission } from './qualityReviewSubmissionContract.mjs';
import { readQualityReviewPair, requireDistinctQualityReviewers } from './qualityReviewPair.mjs';

function reviewSelection(context, reviewerOne, reviewerTwo, now) {
  if (reviewerOne === null && reviewerTwo === null) return { cases: context.cases, parentReviews: null, earliest: context.protocol.createdAt };
  const pair = readQualityReviewPair(context, reviewerOne, reviewerTwo, now);
  if (!pair.disputes.length) throw new Error('quality_review_no_disputes');
  return { cases: pair.disputes, parentReviews: pair.parentReviews, earliest: pair.earliest, provenance: pair.provenance };
}

/** Empty worksheets only. Real judgments and attestations belong to the assigned reviewer. */
export function createQualityReviewTemplate({ protocol, packet, reviewerId, provenance, reviewerOne = null, reviewerTwo = null,
  now = new Date().toISOString(), random = randomBytes }) {
  const context = qualityReviewContext(protocol, packet); requireQualityReviewTime(context, now, { current: true });
  const selection = reviewSelection(context, reviewerOne, reviewerTwo, now);
  provenance ??= selection.provenance;
  if (!qualityReviewerId(reviewerId) || !qualityReviewProvenance(provenance) ||
      selection.provenance && selection.provenance !== provenance) throw new Error('quality_review_template_invalid');
  const entropy = random(32);
  if (!Buffer.isBuffer(entropy) || entropy.length !== 32) throw new Error('quality_review_template_invalid');
  const result = { version: 'quality_review_template.v1', protocolId: protocol.id, packetDigest: context.packetDigest,
    reviewerId, submissionId: entropy.toString('hex'), createdAt: now, expiresAt: context.expiresAt, provenance,
    independentReviewConfirmed: false, parentReviews: selection.parentReviews,
    labels: selection.cases.map(row => ({ ...row, target: null })) };
  if (selection.parentReviews) requireDistinctQualityReviewers([reviewerOne, reviewerTwo, result]);
  return result;
}

export function finalizeQualityReviewSubmission({ protocol, packet, template, reviewerOne = null, reviewerTwo = null, now = new Date().toISOString() }) {
  const context = qualityReviewContext(protocol, packet); requireQualityReviewTime(context, now, { current: true });
  const selection = reviewSelection(context, reviewerOne, reviewerTwo, now);
  if (!validQualityReviewDocument(template, context, { ...selection, now }) ||
      selection.provenance && template.provenance !== selection.provenance) throw new Error('quality_review_template_invalid');
  if (template.independentReviewConfirmed !== (template.provenance === 'independent_human.v1')) throw new Error('quality_review_attestation_required');
  if (selection.parentReviews) requireDistinctQualityReviewers([reviewerOne, reviewerTwo, template]);
  const result = { ...template, version: 'quality_review_submission.v1', submittedAt: now,
    labels: orderedQualityReviewRows(template.labels).map(row => ({ ...row })) };
  readQualityReviewSubmission(result, context, { ...selection, now });
  return result;
}

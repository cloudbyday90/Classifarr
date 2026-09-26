/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readQualityReferences } from './sourcePairQualityContract.mjs';
import { qualityReviewContext, QUALITY_REVIEW_LIMITS } from './qualityReviewBinding.mjs';
import { readQualityReviewSubmission, qualityReviewSubmissionDigest } from './qualityReviewSubmissionContract.mjs';
import { readQualityReviewPair, requireDistinctQualityReviewers } from './qualityReviewPair.mjs';
import { resolveIndependentReviewDecision } from './independentReviewDecision.mjs';

/** Partial agreement is retained; unresolved cases never receive a guessed reference. */
export function composeQualityReviewReference({ protocol, packet, reviewerOne, reviewerTwo, adjudication = null, now = new Date().toISOString() }) {
  const context = qualityReviewContext(protocol, packet), pair = readQualityReviewPair(context, reviewerOne, reviewerTwo, now);
  let third = new Map();
  if (adjudication !== null) {
    if (!pair.disputes.length) throw new Error('quality_review_no_disputes');
    third = readQualityReviewSubmission(adjudication, context, { now, cases: pair.disputes, parentReviews: pair.parentReviews, earliest: pair.earliest });
    requireDistinctQualityReviewers([reviewerOne, reviewerTwo, adjudication]);
    if (adjudication.provenance !== pair.provenance) throw new Error('quality_review_provenance_mismatch');
  }
  const labels = [], unresolved = [], summary = { total: context.cases.length, resolved: 0, unanimous: 0, adjudicated: 0, missing: 0, disagreement: 0 };
  for (const row of context.cases) {
    const first = pair.first.get(row.item), second = pair.second.get(row.item);
    const decision = resolveIndependentReviewDecision(first, second, third.get(row.item));
    if (decision) {
      labels.push({ ...row, target: decision.value, consensus: decision.consensus, reviewerCount: decision.reviewerCount });
      summary.resolved++; summary[decision.consensus]++;
    } else {
      const reason = first === null || second === null ? 'missing' : 'disagreement';
      summary[reason]++; unresolved.push({ ...row, reason });
    }
  }
  const reference = { version: 'source_pair_quality_reference.v1', protocolId: protocol.id, provenance: pair.provenance, labels };
  readQualityReferences(reference, protocol);
  return { reference, receipt: { version: 'quality_review_consensus.v1', protocolId: protocol.id, packetDigest: context.packetDigest,
    parentReviews: pair.parentReviews, adjudicationDigest: adjudication === null ? null : qualityReviewSubmissionDigest(adjudication),
    provenance: pair.provenance, status: summary.resolved === summary.total ? 'complete' : 'incomplete', summary, unresolved,
    limits: { ...QUALITY_REVIEW_LIMITS } } };
}

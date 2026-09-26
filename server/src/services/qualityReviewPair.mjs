/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { qualityHash } from './sourcePairQualityContract.mjs';
import { readQualityReviewSubmission, qualityReviewSubmissionDigest } from './qualityReviewSubmissionContract.mjs';

export function requireDistinctQualityReviewers(submissions) {
  if (new Set(submissions.map(row => row.reviewerId)).size !== submissions.length ||
      new Set(submissions.map(row => row.submissionId)).size !== submissions.length) throw new Error('quality_review_duplicate_reviewers');
}

export function readQualityReviewPair(context, reviewerOne, reviewerTwo, now) {
  const first = readQualityReviewSubmission(reviewerOne, context, { now });
  const second = readQualityReviewSubmission(reviewerTwo, context, { now });
  requireDistinctQualityReviewers([reviewerOne, reviewerTwo]);
  if (reviewerOne.provenance !== reviewerTwo.provenance) throw new Error('quality_review_provenance_mismatch');
  const disputes = context.cases.filter(row => first.get(row.item) !== null && second.get(row.item) !== null && first.get(row.item) !== second.get(row.item));
  return { first, second, disputes, provenance: reviewerOne.provenance,
    earliest: new Date(Math.max(Date.parse(reviewerOne.submittedAt), Date.parse(reviewerTwo.submittedAt))).toISOString(),
    parentReviews: qualityHash([qualityReviewSubmissionDigest(reviewerOne), qualityReviewSubmissionDigest(reviewerTwo)].sort()) };
}

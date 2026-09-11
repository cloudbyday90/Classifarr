/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildHeldOutSemanticStudyReviewerSubmissionTemplate,
} from './heldOutSemanticStudyReviewerSubmissionTemplate.mjs';

function hasDistinctSubmissionIds(reviewerOne, reviewerTwo) {
  return reviewerOne && reviewerTwo &&
    typeof reviewerOne.submissionId === 'string' &&
    typeof reviewerTwo.submissionId === 'string' &&
    reviewerOne.submissionId !== reviewerTwo.submissionId;
}

/**
 * Builds the two independently bound, content-free worksheets required for a
 * reference set. This deliberately automates preparation, not the labels:
 * replacing independent reviewers with system output would make the study
 * circular and unable to measure retrieval quality.
 */
export function buildHeldOutSemanticStudyReviewerSubmissionPair({
  createTemplate = buildHeldOutSemanticStudyReviewerSubmissionTemplate,
  now = new Date(),
  packet,
} = {}) {
  if (typeof createTemplate !== 'function') return null;

  const reviewerOne = createTemplate({ now, packet });
  const reviewerTwo = createTemplate({ now, packet });
  if (!hasDistinctSubmissionIds(reviewerOne, reviewerTwo)) return null;

  return Object.freeze({ reviewerOne, reviewerTwo });
}

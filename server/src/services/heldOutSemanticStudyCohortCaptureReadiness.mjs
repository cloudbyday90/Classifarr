/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildHeldOutSemanticStudyCohortTargets,
  HELD_OUT_SEMANTIC_STUDY_COHORT_STRATA,
  HELD_OUT_SEMANTIC_STUDY_DEFAULT_COHORT_CASE_COUNT,
} from './heldOutSemanticStudyCohortPlanner.mjs';
import {
  HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_STATUS_IDS,
  HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_VERSION,
} from './heldOutSemanticStudyEligibilityAuditContract.mjs';

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function hasBalancedEligibleCounts(summary, targets) {
  if (!summary || typeof summary !== 'object' ||
      !summary.candidateCountByStratum || typeof summary.candidateCountByStratum !== 'object' ||
      !summary.eligibleCountByStratum || typeof summary.eligibleCountByStratum !== 'object') {
    return false;
  }

  let candidateTotal = 0;
  for (const stratum of HELD_OUT_SEMANTIC_STUDY_COHORT_STRATA) {
    const candidateCount = summary.candidateCountByStratum[stratum];
    const eligibleCount = summary.eligibleCountByStratum[stratum];
    if (!nonNegativeInteger(candidateCount) || !nonNegativeInteger(eligibleCount) ||
        eligibleCount > candidateCount || eligibleCount < targets[stratum]) {
      return false;
    }
    candidateTotal += candidateCount;
  }
  return nonNegativeInteger(summary.candidateCount) && summary.candidateCount === candidateTotal;
}

/**
 * Returns only whether a current complete aggregate audit has enough balanced,
 * policy-eligible cases for the existing controlled private-capture workflow.
 * It does not expose audit data, select media, retain snapshots, call AI/RAG,
 * or authorize labels, semantic evaluation, or routing.
 */
export function isHeldOutSemanticStudyPrivateCohortCaptureReady(receipt) {
  const targets = buildHeldOutSemanticStudyCohortTargets(
    HELD_OUT_SEMANTIC_STUDY_DEFAULT_COHORT_CASE_COUNT,
  );
  return receipt?.version === HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_VERSION &&
    receipt?.status?.id === HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_STATUS_IDS.COMPLETE &&
    hasBalancedEligibleCounts(receipt.summary, targets);
}

/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_STATUS_IDS,
} from './policyCandidateContrastiveRetrievalContract.mjs';

export const HELD_OUT_SEMANTIC_STUDY_COMPARISON_ELIGIBILITY_PARTITION_VERSION =
  'policy.held_out_semantic_study_comparison_eligibility_partition.v1';

export const HELD_OUT_SEMANTIC_STUDY_COMPARISON_ELIGIBILITY_PARTITION_IDS = Object.freeze({
  IDENTITY_UNVERIFIED: 'identity_unverified',
  INSUFFICIENT_POLICY_CANDIDATES: 'insufficient_policy_candidates',
  INVALID_CONTRACT: 'invalid_contract',
  NOT_PENDING_POLICY_DECISION: 'not_pending_policy_decision',
  READY_COMPARISON: 'ready_comparison',
});

const CONTRACT_STATUS_TO_PARTITION_ID = Object.freeze({
  [POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_STATUS_IDS.IDENTITY_UNVERIFIED]:
    HELD_OUT_SEMANTIC_STUDY_COMPARISON_ELIGIBILITY_PARTITION_IDS.IDENTITY_UNVERIFIED,
  [POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_STATUS_IDS.INSUFFICIENT_CANDIDATES]:
    HELD_OUT_SEMANTIC_STUDY_COMPARISON_ELIGIBILITY_PARTITION_IDS.INSUFFICIENT_POLICY_CANDIDATES,
  [POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_STATUS_IDS.NOT_PENDING_POLICY_DECISION]:
    HELD_OUT_SEMANTIC_STUDY_COMPARISON_ELIGIBILITY_PARTITION_IDS.NOT_PENDING_POLICY_DECISION,
});

function fixedCounts() {
  return Object.fromEntries(Object.values(
    HELD_OUT_SEMANTIC_STUDY_COMPARISON_ELIGIBILITY_PARTITION_IDS,
  ).map((id) => [id, 0]));
}

/**
 * Assigns every attempted policy-only comparison to exactly one fixed result.
 * A malformed result remains visible only as an aggregate invalid-contract
 * count; it can never qualify a semantic study case.
 */
export function heldOutSemanticStudyComparisonEligibilityPartitionId(assessment = {}) {
  const contract = assessment?.contract;
  if (contract?.valid === true &&
      contract.statusId === POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_STATUS_IDS.READY) {
    return HELD_OUT_SEMANTIC_STUDY_COMPARISON_ELIGIBILITY_PARTITION_IDS.READY_COMPARISON;
  }

  if (contract?.valid === false && CONTRACT_STATUS_TO_PARTITION_ID[contract.statusId]) {
    return CONTRACT_STATUS_TO_PARTITION_ID[contract.statusId];
  }

  return HELD_OUT_SEMANTIC_STUDY_COMPARISON_ELIGIBILITY_PARTITION_IDS.INVALID_CONTRACT;
}

/**
 * Builds an aggregate-only partition for a completed candidate assessment.
 * It makes a zero-ready result machine-readable without retaining any case,
 * policy, library, or configuration identity.
 */
export function buildHeldOutSemanticStudyComparisonEligibilityPartition({ assessments } = {}) {
  const counts = fixedCounts();
  for (const assessment of Array.isArray(assessments) ? assessments : []) {
    const id = heldOutSemanticStudyComparisonEligibilityPartitionId(assessment);
    counts[id] += 1;
  }

  const eligibleComparisonCount = counts[
    HELD_OUT_SEMANTIC_STUDY_COMPARISON_ELIGIBILITY_PARTITION_IDS.READY_COMPARISON
  ];
  const comparisonCount = Object.values(counts).reduce((total, count) => total + count, 0);

  return Object.freeze({
    comparisonCount,
    eligibleComparisonCount,
    ineligibleComparisonCount: comparisonCount - eligibleComparisonCount,
    policyOnlyComparisonAvailable: eligibleComparisonCount > 0,
    rawCandidateDataExposed: false,
    reasonCounts: Object.freeze(counts),
    semanticSelection: false,
    version: HELD_OUT_SEMANTIC_STUDY_COMPARISON_ELIGIBILITY_PARTITION_VERSION,
  });
}

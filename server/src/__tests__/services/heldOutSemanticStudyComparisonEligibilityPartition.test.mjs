/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, test } from '@jest/globals';
import {
  buildHeldOutSemanticStudyComparisonEligibilityPartition,
  HELD_OUT_SEMANTIC_STUDY_COMPARISON_ELIGIBILITY_PARTITION_IDS,
  heldOutSemanticStudyComparisonEligibilityPartitionId,
} from '../../services/heldOutSemanticStudyComparisonEligibilityPartition.mjs';

test('partitions every policy-only assessment into one fixed aggregate reason', () => {
  const partition = buildHeldOutSemanticStudyComparisonEligibilityPartition({
    assessments: [
      { contract: { valid: true, statusId: 'ready', candidates: [{}, {}] } },
      { contract: { valid: false, statusId: 'not_pending_policy_decision' } },
      { contract: { valid: false, statusId: 'insufficient_candidates' } },
      { contract: { valid: false, statusId: 'identity_unverified' } },
      { contract: { valid: true, statusId: 'not_pending_policy_decision' } },
      { contract: { valid: false, statusId: 'untrusted_status' } },
    ],
  });

  expect(partition).toEqual({
    version: 'policy.held_out_semantic_study_comparison_eligibility_partition.v1',
    comparisonCount: 6,
    eligibleComparisonCount: 1,
    ineligibleComparisonCount: 5,
    policyOnlyComparisonAvailable: true,
    rawCandidateDataExposed: false,
    reasonCounts: {
      identity_unverified: 1,
      insufficient_policy_candidates: 1,
      invalid_contract: 2,
      not_pending_policy_decision: 1,
      ready_comparison: 1,
    },
    semanticSelection: false,
  });
});

test('fails closed to invalid contract rather than treating malformed assessments as eligible', () => {
  expect(heldOutSemanticStudyComparisonEligibilityPartitionId()).toBe(
    HELD_OUT_SEMANTIC_STUDY_COMPARISON_ELIGIBILITY_PARTITION_IDS.INVALID_CONTRACT,
  );
  expect(heldOutSemanticStudyComparisonEligibilityPartitionId({
    contract: { valid: false, statusId: 'ready' },
  })).toBe(HELD_OUT_SEMANTIC_STUDY_COMPARISON_ELIGIBILITY_PARTITION_IDS.INVALID_CONTRACT);
  expect(buildHeldOutSemanticStudyComparisonEligibilityPartition()).toEqual(expect.objectContaining({
    comparisonCount: 0,
    eligibleComparisonCount: 0,
    ineligibleComparisonCount: 0,
    policyOnlyComparisonAvailable: false,
    reasonCounts: {
      identity_unverified: 0,
      insufficient_policy_candidates: 0,
      invalid_contract: 0,
      not_pending_policy_decision: 0,
      ready_comparison: 0,
    },
  }));
});

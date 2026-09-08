/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, test } from '@jest/globals';
import {
  buildHeldOutSemanticStudyNotPendingDecisionPartition,
  HELD_OUT_SEMANTIC_STUDY_NOT_PENDING_DECISION_PARTITION_IDS,
  heldOutSemanticStudyNotPendingDecisionPartitionId,
} from '../../services/heldOutSemanticStudyNotPendingDecisionPartition.mjs';

function assessment(evaluationStageId, actionId = 'manual', rankedCandidateCountId = 'none') {
  return {
    contract: { valid: false, statusId: 'not_pending_policy_decision' },
    diagnostic: { actionId, evaluationStageId, rankedCandidateCountId },
  };
}

test('partitions every not-pending decision using only a fixed evaluator stage', () => {
  const partition = buildHeldOutSemanticStudyNotPendingDecisionPartition({
    assessments: [
      assessment('no_active_policies'),
      assessment('no_compatible_media_type_policies'),
      assessment('no_qualifying_policy_evaluations'),
      assessment('ranked_policy_decision', 'auto_classify', 'one'),
      assessment('unknown'),
      { contract: { valid: true, statusId: 'ready' } },
      assessment('authoritative_signal'),
    ],
  });

  expect(partition).toEqual({
    version: 'policy.held_out_semantic_study_not_pending_decision_partition.v1',
    notPendingComparisonCount: 6,
    rawCandidateDataExposed: false,
    reasonCounts: {
      invalid_not_pending_observation: 1,
      no_active_policies: 1,
      no_compatible_media_type_policies: 1,
      no_qualifying_policy_evaluations: 1,
      ranked_non_pending_decision: 1,
      unknown_evaluation_path: 1,
    },
    semanticSelection: false,
  });
  expect(JSON.stringify(partition)).not.toMatch(/library|tmdb|provider|configuration/u);
});

test('fails closed when the not-pending contract contradicts the fixed stage', () => {
  expect(heldOutSemanticStudyNotPendingDecisionPartitionId(
    assessment('no_active_policies', 'manual', 'one'),
  )).toBe(HELD_OUT_SEMANTIC_STUDY_NOT_PENDING_DECISION_PARTITION_IDS.INVALID_NOT_PENDING_OBSERVATION);
  expect(heldOutSemanticStudyNotPendingDecisionPartitionId({
    contract: { valid: false, statusId: 'ready' },
  })).toBe(HELD_OUT_SEMANTIC_STUDY_NOT_PENDING_DECISION_PARTITION_IDS.INVALID_NOT_PENDING_OBSERVATION);
  expect(heldOutSemanticStudyNotPendingDecisionPartitionId(
    assessment('ranked_policy_decision', 'auto_classify', 'none'),
  )).toBe(HELD_OUT_SEMANTIC_STUDY_NOT_PENDING_DECISION_PARTITION_IDS.INVALID_NOT_PENDING_OBSERVATION);
});

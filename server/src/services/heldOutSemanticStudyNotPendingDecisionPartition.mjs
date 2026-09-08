/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_STATUS_IDS,
} from './policyCandidateContrastiveRetrievalContract.mjs';
import {
  HELD_OUT_SEMANTIC_STUDY_POLICY_ACTION_IDS,
  HELD_OUT_SEMANTIC_STUDY_RANKED_CANDIDATE_COUNT_IDS,
} from './heldOutSemanticStudyEligibilityDiagnostics.mjs';
import {
  HELD_OUT_SEMANTIC_STUDY_POLICY_EVALUATION_STAGE_IDS,
  heldOutSemanticStudyPolicyEvaluationStageId,
} from './heldOutSemanticStudyPolicyEvaluationStage.mjs';

export const HELD_OUT_SEMANTIC_STUDY_NOT_PENDING_DECISION_PARTITION_VERSION =
  'policy.held_out_semantic_study_not_pending_decision_partition.v1';

export const HELD_OUT_SEMANTIC_STUDY_NOT_PENDING_DECISION_PARTITION_IDS = Object.freeze({
  INVALID_NOT_PENDING_OBSERVATION: 'invalid_not_pending_observation',
  NO_ACTIVE_POLICIES: 'no_active_policies',
  NO_COMPATIBLE_MEDIA_TYPE_POLICIES: 'no_compatible_media_type_policies',
  NO_QUALIFYING_POLICY_EVALUATIONS: 'no_qualifying_policy_evaluations',
  RANKED_NON_PENDING_DECISION: 'ranked_non_pending_decision',
  UNKNOWN_EVALUATION_PATH: 'unknown_evaluation_path',
});

const ACTION_IDS = new Set(HELD_OUT_SEMANTIC_STUDY_POLICY_ACTION_IDS);
const RANKED_CANDIDATE_COUNT_IDS = new Set(HELD_OUT_SEMANTIC_STUDY_RANKED_CANDIDATE_COUNT_IDS);

function fixedCounts() {
  return Object.fromEntries(Object.values(
    HELD_OUT_SEMANTIC_STUDY_NOT_PENDING_DECISION_PARTITION_IDS,
  ).map((id) => [id, 0]));
}

function isNotPendingPolicyDecision(assessment) {
  return assessment?.contract?.valid === false &&
    assessment.contract.statusId ===
      POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_STATUS_IDS.NOT_PENDING_POLICY_DECISION;
}

function validNoCandidateDiagnostic(diagnostic) {
  return diagnostic?.actionId === 'manual' && diagnostic?.rankedCandidateCountId === 'none';
}

function validRankedNonPendingDiagnostic(diagnostic) {
  const validAction = ACTION_IDS.has(diagnostic?.actionId) &&
    RANKED_CANDIDATE_COUNT_IDS.has(diagnostic?.rankedCandidateCountId) &&
    diagnostic.actionId !== 'prompt_confirm' &&
    diagnostic.actionId !== 'prompt_select' &&
    diagnostic.actionId !== 'unknown';
  return validAction && (diagnostic.actionId !== 'auto_classify' ||
    diagnostic.rankedCandidateCountId !== 'none');
}

/**
 * Explains a non-pending policy decision only through its fixed evaluator
 * stage. A malformed observation remains aggregate-only and can never make a
 * comparison eligible.
 */
export function heldOutSemanticStudyNotPendingDecisionPartitionId(assessment = {}) {
  if (!isNotPendingPolicyDecision(assessment)) {
    return HELD_OUT_SEMANTIC_STUDY_NOT_PENDING_DECISION_PARTITION_IDS.INVALID_NOT_PENDING_OBSERVATION;
  }

  const stageId = heldOutSemanticStudyPolicyEvaluationStageId(
    assessment?.diagnostic?.evaluationStageId,
  );
  const diagnostic = assessment?.diagnostic;
  switch (stageId) {
    case HELD_OUT_SEMANTIC_STUDY_POLICY_EVALUATION_STAGE_IDS.NO_ACTIVE_POLICIES:
      return validNoCandidateDiagnostic(diagnostic)
        ? HELD_OUT_SEMANTIC_STUDY_NOT_PENDING_DECISION_PARTITION_IDS.NO_ACTIVE_POLICIES
        : HELD_OUT_SEMANTIC_STUDY_NOT_PENDING_DECISION_PARTITION_IDS.INVALID_NOT_PENDING_OBSERVATION;
    case HELD_OUT_SEMANTIC_STUDY_POLICY_EVALUATION_STAGE_IDS.NO_COMPATIBLE_MEDIA_TYPE_POLICIES:
      return validNoCandidateDiagnostic(diagnostic)
        ? HELD_OUT_SEMANTIC_STUDY_NOT_PENDING_DECISION_PARTITION_IDS.NO_COMPATIBLE_MEDIA_TYPE_POLICIES
        : HELD_OUT_SEMANTIC_STUDY_NOT_PENDING_DECISION_PARTITION_IDS.INVALID_NOT_PENDING_OBSERVATION;
    case HELD_OUT_SEMANTIC_STUDY_POLICY_EVALUATION_STAGE_IDS.NO_QUALIFYING_POLICY_EVALUATIONS:
      return validNoCandidateDiagnostic(diagnostic)
        ? HELD_OUT_SEMANTIC_STUDY_NOT_PENDING_DECISION_PARTITION_IDS.NO_QUALIFYING_POLICY_EVALUATIONS
        : HELD_OUT_SEMANTIC_STUDY_NOT_PENDING_DECISION_PARTITION_IDS.INVALID_NOT_PENDING_OBSERVATION;
    case HELD_OUT_SEMANTIC_STUDY_POLICY_EVALUATION_STAGE_IDS.RANKED_POLICY_DECISION:
      return validRankedNonPendingDiagnostic(diagnostic)
        ? HELD_OUT_SEMANTIC_STUDY_NOT_PENDING_DECISION_PARTITION_IDS.RANKED_NON_PENDING_DECISION
        : HELD_OUT_SEMANTIC_STUDY_NOT_PENDING_DECISION_PARTITION_IDS.INVALID_NOT_PENDING_OBSERVATION;
    case HELD_OUT_SEMANTIC_STUDY_POLICY_EVALUATION_STAGE_IDS.UNKNOWN:
      return HELD_OUT_SEMANTIC_STUDY_NOT_PENDING_DECISION_PARTITION_IDS.UNKNOWN_EVALUATION_PATH;
    default:
      return HELD_OUT_SEMANTIC_STUDY_NOT_PENDING_DECISION_PARTITION_IDS.INVALID_NOT_PENDING_OBSERVATION;
  }
}

/**
 * Builds a mutually exclusive aggregate explanation for comparisons stopped
 * before semantic retrieval. It accepts completed assessments but retains no
 * assessment, candidate, policy, library, provider, or configuration value.
 */
export function buildHeldOutSemanticStudyNotPendingDecisionPartition({ assessments } = {}) {
  const reasonCounts = fixedCounts();
  for (const assessment of Array.isArray(assessments) ? assessments : []) {
    if (!isNotPendingPolicyDecision(assessment)) continue;
    reasonCounts[heldOutSemanticStudyNotPendingDecisionPartitionId(assessment)] += 1;
  }

  const notPendingComparisonCount = Object.values(reasonCounts)
    .reduce((total, count) => total + count, 0);

  return Object.freeze({
    notPendingComparisonCount,
    rawCandidateDataExposed: false,
    reasonCounts: Object.freeze(reasonCounts),
    semanticSelection: false,
    version: HELD_OUT_SEMANTIC_STUDY_NOT_PENDING_DECISION_PARTITION_VERSION,
  });
}

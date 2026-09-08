/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const HELD_OUT_SEMANTIC_STUDY_POLICY_EVALUATION_STAGE_IDS = Object.freeze({
  AUTHORITATIVE_SIGNAL: 'authoritative_signal',
  NO_ACTIVE_POLICIES: 'no_active_policies',
  NO_COMPATIBLE_MEDIA_TYPE_POLICIES: 'no_compatible_media_type_policies',
  NO_QUALIFYING_POLICY_EVALUATIONS: 'no_qualifying_policy_evaluations',
  RANKED_POLICY_DECISION: 'ranked_policy_decision',
  UNKNOWN: 'unknown',
});

const STAGE_IDS = new Set(Object.values(HELD_OUT_SEMANTIC_STUDY_POLICY_EVALUATION_STAGE_IDS));

/**
 * Creates ephemeral state for the restricted held-out evaluator. It is never
 * persisted or returned directly; the aggregate audit reduces it to a fixed
 * count before producing a receipt.
 */
export function createHeldOutSemanticStudyPolicyEvaluationStageState() {
  return Object.seal({ stageId: null });
}

/** Records only a fixed stage identifier when a restricted evaluation opts in. */
export function recordHeldOutSemanticStudyPolicyEvaluationStage(options, stageId) {
  const state = options?.heldOutSemanticStudyPolicyEvaluationStageState;
  if (state && typeof state === 'object' && STAGE_IDS.has(stageId)) {
    state.stageId = stageId;
  }
}

/** Normalizes an optional transient stage into a fixed public-safe identifier. */
export function heldOutSemanticStudyPolicyEvaluationStageId(value) {
  return STAGE_IDS.has(value) ? value : HELD_OUT_SEMANTIC_STUDY_POLICY_EVALUATION_STAGE_IDS.UNKNOWN;
}

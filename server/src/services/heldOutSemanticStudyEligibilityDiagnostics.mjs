/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { heldOutSemanticStudyPolicyEvaluationStageId } from './heldOutSemanticStudyPolicyEvaluationStage.mjs';

export const HELD_OUT_SEMANTIC_STUDY_POLICY_ACTION_IDS = Object.freeze([
  'auto_classify',
  'manual',
  'prompt_confirm',
  'prompt_select',
  'unknown',
]);

export const HELD_OUT_SEMANTIC_STUDY_RANKED_CANDIDATE_COUNT_IDS = Object.freeze([
  'none',
  'one',
  'two_or_more',
]);

const POLICY_ACTION_IDS = new Set(HELD_OUT_SEMANTIC_STUDY_POLICY_ACTION_IDS);

function actionId(value) {
  return POLICY_ACTION_IDS.has(value) ? value : 'unknown';
}

function rankedCandidateCountId(ranked) {
  const count = Array.isArray(ranked) ? ranked.length : 0;
  if (count === 0) return 'none';
  return count === 1 ? 'one' : 'two_or_more';
}

/**
 * Reduces a broad-policy result to fixed aggregate categories. It intentionally
 * omits scores, policy and library identifiers, item metadata, and evidence.
 */
export function heldOutSemanticStudyEligibilityDiagnostic(policyResult = {}, { evaluationStageId } = {}) {
  return Object.freeze({
    actionId: actionId(policyResult?.action),
    evaluationStageId: heldOutSemanticStudyPolicyEvaluationStageId(evaluationStageId),
    rankedCandidateCountId: rankedCandidateCountId(policyResult?.ranked),
  });
}

/**
 * Produces a stable aggregate key for a diagnostic receipt without preserving
 * a per-item record.
 */
export function heldOutSemanticStudyEligibilityDiagnosticCountId(diagnostic = {}) {
  const normalized = heldOutSemanticStudyEligibilityDiagnostic({
    action: diagnostic?.actionId,
    ranked: Array.from({
      length: diagnostic?.rankedCandidateCountId === 'two_or_more'
        ? 2
        : diagnostic?.rankedCandidateCountId === 'one' ? 1 : 0,
    }),
  });
  return `${normalized.actionId}:${normalized.rankedCandidateCountId}`;
}

/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { isWeakCandidateViability } from './policyCandidateDiagnostics.mjs';
import { resolvePolicyCandidateDecisionBand } from './policyCandidateDecisionBand.mjs';
import {
  normalizePolicyDecisionThresholds,
  POLICY_CLOSE_SCORE_MARGIN,
  POLICY_PROMPT_SELECT_MIN_CONFIDENCE,
} from '../utils/policyThresholds.mjs';

function normalizeRankedEvaluation(evaluation = {}) {
  const normalizedThresholds = normalizePolicyDecisionThresholds(evaluation);

  return {
    ...evaluation,
    auto_classify_threshold: normalizedThresholds.autoClassifyThreshold,
    prompt_threshold: normalizedThresholds.promptThreshold,
  };
}

export function allPolicyCandidatesUseWeakEvidence(candidates) {
  return Array.isArray(candidates)
    && candidates.length > 0
    && candidates.every((candidate) => isWeakCandidateViability(candidate?.candidate_diagnostics));
}

export function getAmbiguousTopPolicyCandidates(ranked) {
  if (!Array.isArray(ranked) || ranked.length < 2) {
    return [];
  }

  const topScore = ranked[0].score;
  return ranked.filter((candidate) => Math.abs(topScore - candidate.score) <= POLICY_CLOSE_SCORE_MARGIN);
}

/**
 * Projects the deterministic candidate action without finalizing a decision.
 * Callers that persist metrics or route media must retain their own explicit
 * authority boundary after this function returns.
 */
export function projectPolicyCandidateDecision({ ranked = [] } = {}) {
  const normalizedRanked = Array.isArray(ranked)
    ? ranked.map((evaluation) => normalizeRankedEvaluation(evaluation))
    : [];

  if (normalizedRanked.length === 0) {
    return {
      action: 'manual',
      top: null,
      ranked: normalizedRanked,
      decisionDiagnostics: null,
    };
  }

  const top = normalizedRanked[0];
  const ambiguousTopCandidates = getAmbiguousTopPolicyCandidates(normalizedRanked);
  const topUsesWeakEvidence = isWeakCandidateViability(top?.candidate_diagnostics);
  const weakEvidenceOverlap = allPolicyCandidatesUseWeakEvidence(ambiguousTopCandidates);

  if (ambiguousTopCandidates.length > 1) {
    return {
      action: weakEvidenceOverlap
        ? 'manual'
        : top.score >= POLICY_PROMPT_SELECT_MIN_CONFIDENCE ? 'prompt_select' : 'manual',
      top,
      ranked: normalizedRanked,
      decisionDiagnostics: weakEvidenceOverlap
        ? {
          requires_manual_review: true,
          reason_code: 'weak_evidence_overlap',
          candidate_count: ambiguousTopCandidates.length,
        }
        : null,
    };
  }

  if (topUsesWeakEvidence && top.score >= POLICY_PROMPT_SELECT_MIN_CONFIDENCE) {
    return {
      action: 'prompt_select',
      top,
      ranked: normalizedRanked,
      decisionDiagnostics: {
        requires_manual_review: true,
        reason_code: 'weak_evidence_primary',
        candidate_count: 1,
      },
    };
  }

  const decisionBand = resolvePolicyCandidateDecisionBand({
    score: top.score,
    promptThreshold: top.prompt_threshold,
    autoClassifyThreshold: top.auto_classify_threshold,
  });

  return {
    action: decisionBand.action,
    top,
    ranked: normalizedRanked,
    decisionDiagnostics: null,
  };
}

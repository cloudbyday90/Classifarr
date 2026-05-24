import { policyDecisionBuilder } from './policyDecisionBuilder.mjs';
import { policyThresholdIntegrityService } from './policyThresholdIntegrityService.mjs';
import { createLogger } from '../utils/logger.mjs';
import { isWeakCandidateViability } from './policyCandidateDiagnostics.mjs';
import {
  normalizePolicyDecisionThresholds,
  POLICY_CLOSE_SCORE_MARGIN,
  POLICY_PROMPT_SELECT_MIN_CONFIDENCE,
} from '../utils/policyThresholds.mjs';

const logger = createLogger('PolicyCandidateRanker');

function normalizeRankedEvaluation(evaluation) {
  const normalizedThresholds = normalizePolicyDecisionThresholds(evaluation);

  return {
    ...evaluation,
    auto_classify_threshold: normalizedThresholds.autoClassifyThreshold,
    prompt_threshold: normalizedThresholds.promptThreshold,
  };
}

function compareRankedEvaluations(left, right) {
  const scoreDelta = right.score - left.score;
  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  const libraryDelta = Number(left.library_id || 0) - Number(right.library_id || 0);
  if (libraryDelta !== 0) {
    return libraryDelta;
  }

  const policyDelta = Number(left.policy_id || 0) - Number(right.policy_id || 0);
  if (policyDelta !== 0) {
    return policyDelta;
  }

  const libraryNameDelta = String(left.library_name || '').localeCompare(String(right.library_name || ''));
  if (libraryNameDelta !== 0) {
    return libraryNameDelta;
  }

  return String(left.policy_name || '').localeCompare(String(right.policy_name || ''));
}

export class PolicyCandidateRanker {
  allCandidatesUseWeakEvidence(candidates) {
    return Array.isArray(candidates)
      && candidates.length > 0
      && candidates.every((candidate) => isWeakCandidateViability(candidate?.candidate_diagnostics));
  }

  getAmbiguousTopCandidates(ranked) {
    if (!Array.isArray(ranked) || ranked.length < 2) {
      return [];
    }

    const topScore = ranked[0].score;
    return ranked.filter((candidate) => Math.abs(topScore - candidate.score) <= POLICY_CLOSE_SCORE_MARGIN);
  }

  async rankResults(evaluations) {
    try {
      const ranked = evaluations
        .filter((evaluation) => Number.isFinite(evaluation?.score) && evaluation.score > 0)
        .map((evaluation) => {
          const normalizedEvaluation = normalizeRankedEvaluation(evaluation);
          const normalizedThresholds = normalizePolicyDecisionThresholds(evaluation);

          policyThresholdIntegrityService.warnOnNormalizedThresholds({
            source: 'policy_ranking',
            thresholds: evaluation,
            normalizedThresholds,
          });

          return normalizedEvaluation;
        })
        .sort(compareRankedEvaluations);

      return ranked;
    } catch (error) {
      logger.error('Failed to rank results', { error: error.message });
      return evaluations;
    }
  }

  determineAction(ranked) {
    try {
      const normalizedRanked = Array.isArray(ranked)
        ? ranked.map((evaluation) => normalizeRankedEvaluation(evaluation))
        : [];

      if (normalizedRanked.length === 0) {
        return policyDecisionBuilder.normalizeResult({
          action: 'manual',
          confidence: 0,
          ranked: []
        });
      }

      const top = normalizedRanked[0];
      const ambiguousTopCandidates = this.getAmbiguousTopCandidates(normalizedRanked);
      const topUsesWeakEvidence = isWeakCandidateViability(top?.candidate_diagnostics);
      const weakEvidenceOverlap = this.allCandidatesUseWeakEvidence(ambiguousTopCandidates);

      if (ambiguousTopCandidates.length > 1) {
        logger.info('Policy ranking is ambiguous; degrading to conservative selection', {
          topScore: top.score,
          closeScoreMargin: POLICY_CLOSE_SCORE_MARGIN,
          candidateCount: ambiguousTopCandidates.length,
          weakEvidenceOnly: weakEvidenceOverlap,
          candidates: ambiguousTopCandidates.map((candidate) => ({
            policy_id: candidate.policy_id,
            library_id: candidate.library_id,
            score: candidate.score,
            primary_viability: candidate?.candidate_diagnostics?.primary_viability || null,
          })),
        });

        return policyDecisionBuilder.buildPolicyDecision({
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
        });
      }

      if (topUsesWeakEvidence && top.score >= POLICY_PROMPT_SELECT_MIN_CONFIDENCE) {
        logger.info('Top policy candidate uses weak evidence only; requiring manual selection flow', {
          libraryId: top.library_id,
          policyId: top.policy_id,
          score: top.score,
          primaryViability: top?.candidate_diagnostics?.primary_viability || null,
        });

        return policyDecisionBuilder.buildPolicyDecision({
          action: 'prompt_select',
          top,
          ranked: normalizedRanked,
          decisionDiagnostics: {
            requires_manual_review: true,
            reason_code: 'weak_evidence_primary',
            candidate_count: 1,
          },
        });
      }

      if (top.score >= top.auto_classify_threshold) {
        return policyDecisionBuilder.buildPolicyDecision({
          action: 'auto_classify',
          top,
          ranked: normalizedRanked
        });
      }

      if (top.score >= top.prompt_threshold) {
        return policyDecisionBuilder.buildPolicyDecision({
          action: 'prompt_confirm',
          top,
          ranked: normalizedRanked
        });
      }

      if (top.score >= POLICY_PROMPT_SELECT_MIN_CONFIDENCE) {
        return policyDecisionBuilder.buildPolicyDecision({
          action: 'prompt_select',
          top,
          ranked: normalizedRanked
        });
      }

      return policyDecisionBuilder.buildPolicyDecision({
        action: 'manual',
        top,
        ranked: normalizedRanked
      });

    } catch (error) {
      logger.error('Failed to determine action', { error: error.message });
      return policyDecisionBuilder.normalizeResult({
        action: 'manual',
        confidence: 0,
        ranked
      });
    }
  }
}

export const policyCandidateRanker = new PolicyCandidateRanker();
export { POLICY_PROMPT_SELECT_MIN_CONFIDENCE, POLICY_CLOSE_SCORE_MARGIN } from '../utils/policyThresholds.mjs';

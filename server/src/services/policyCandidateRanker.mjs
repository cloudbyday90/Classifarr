import { policyDecisionBuilder } from './policyDecisionBuilder.mjs';
import { policyThresholdIntegrityService } from './policyThresholdIntegrityService.mjs';
import { createLogger } from '../utils/logger.mjs';
import { policyOverlapMetricsCollector } from './policyOverlapMetricsCollector.mjs';
import { policyOverlapMetricsSnapshotService } from './policyOverlapMetricsSnapshotService.mjs';
import {
  allPolicyCandidatesUseWeakEvidence,
  getAmbiguousTopPolicyCandidates,
  projectPolicyCandidateDecision,
} from './policyCandidateDecisionProjection.mjs';
import { projectRankedPolicyCandidates } from './policyCandidateRankingProjection.mjs';
import {
  normalizePolicyDecisionThresholds,
  POLICY_CLOSE_SCORE_MARGIN,
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

export class PolicyCandidateRanker {
  finalizeDecision({
    action,
    top = null,
    ranked = [],
    decisionDiagnostics = null,
  }) {
    const result = policyDecisionBuilder.buildPolicyDecision({
      action,
      top,
      ranked,
      decisionDiagnostics,
    });

    policyOverlapMetricsCollector.recordDecision({
      action: result.action,
      ranked: result.ranked,
      decisionDiagnostics: result.decisionDiagnostics,
      candidateDiagnostics: result.candidateDiagnostics,
    });
    policyOverlapMetricsSnapshotService.maybePersistSnapshot({
      reason: 'decision_recorded',
    });

    return result;
  }

  allCandidatesUseWeakEvidence(candidates) {
    return allPolicyCandidatesUseWeakEvidence(candidates);
  }

  getAmbiguousTopCandidates(ranked) {
    return getAmbiguousTopPolicyCandidates(ranked);
  }

  async rankResults(evaluations) {
    try {
      const ranked = projectRankedPolicyCandidates(evaluations)
        .map((calibratedEvaluation) => {
          const normalizedEvaluation = normalizeRankedEvaluation(calibratedEvaluation);
          const normalizedThresholds = normalizePolicyDecisionThresholds(calibratedEvaluation);

          policyThresholdIntegrityService.warnOnNormalizedThresholds({
            source: 'policy_ranking',
            thresholds: calibratedEvaluation,
            normalizedThresholds,
          });

          return normalizedEvaluation;
        });

      return ranked;
    } catch (error) {
      logger.error('Failed to rank results', { error: error.message });
      return evaluations;
    }
  }

  determineAction(ranked) {
    try {
      const projection = projectPolicyCandidateDecision({ ranked });
      if (projection.ranked.length === 0) {
        return policyDecisionBuilder.normalizeResult({
          action: 'manual',
          confidence: 0,
          ranked: []
        });
      }

      const ambiguousTopCandidates = this.getAmbiguousTopCandidates(projection.ranked);
      if (ambiguousTopCandidates.length > 1) {
        logger.info('Policy ranking is ambiguous; degrading to conservative selection', {
          topScore: projection.top.score,
          closeScoreMargin: POLICY_CLOSE_SCORE_MARGIN,
          candidateCount: ambiguousTopCandidates.length,
          weakEvidenceOnly: this.allCandidatesUseWeakEvidence(ambiguousTopCandidates),
          candidates: ambiguousTopCandidates.map((candidate) => ({
            policy_id: candidate.policy_id,
            library_id: candidate.library_id,
            score: candidate.score,
            primary_viability: candidate?.candidate_diagnostics?.primary_viability || null,
          })),
        });
      } else if (projection.decisionDiagnostics?.reason_code === 'weak_evidence_primary') {
        logger.info('Top policy candidate uses weak evidence only; requiring manual selection flow', {
          libraryId: projection.top.library_id,
          policyId: projection.top.policy_id,
          score: projection.top.score,
          primaryViability: projection.top?.candidate_diagnostics?.primary_viability || null,
        });
      }

      return this.finalizeDecision(projection);

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

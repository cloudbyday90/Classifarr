/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * policyCandidateRanker.js
 *
 * Phase 3 PE-3 extraction: ranking and action-determination logic extracted
 * from PolicyEngine. This service is stateless — it only transforms evaluation
 * objects and delegates to policyDecisionBuilder for result normalisation.
 *
 * Extracted from policyEngine.js:
 *  - rankResults(evaluations)   (was policyEngine lines 1095–1109)
 *  - determineAction(ranked)    (was policyEngine lines 1111–1170)
 *
 * policyEngine.js delegates to this service. Behaviour is unchanged.
 */

const policyDecisionBuilder = require('./policyDecisionBuilder');
const { createLogger } = require('../utils/logger');
const {
  normalizePolicyDecisionThresholds,
  POLICY_CLOSE_SCORE_MARGIN,
  POLICY_PROMPT_SELECT_MIN_CONFIDENCE,
} = require('../utils/policyThresholds');

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

class PolicyCandidateRanker {
  getAmbiguousTopCandidates(ranked) {
    if (!Array.isArray(ranked) || ranked.length < 2) {
      return [];
    }

    const topScore = ranked[0].score;
    return ranked.filter((candidate) => Math.abs(topScore - candidate.score) <= POLICY_CLOSE_SCORE_MARGIN);
  }

  /**
   * Sort valid evaluations by score descending (zero-score entries removed).
   *
   * @param {object[]} evaluations — scored policy evaluation objects
   * @returns {Promise<object[]>}  ranked (descending) non-zero evaluations
   */
  async rankResults(evaluations) {
    try {
      const ranked = evaluations
        .filter((evaluation) => Number.isFinite(evaluation?.score) && evaluation.score > 0)
        .map((evaluation) => {
          const normalizedEvaluation = normalizeRankedEvaluation(evaluation);
          const normalizedThresholds = normalizePolicyDecisionThresholds(evaluation);

          if (normalizedThresholds.wasNormalized) {
            logger.warn('Normalized invalid policy thresholds during ranking', {
              policyId: evaluation?.policy_id,
              libraryId: evaluation?.library_id,
              reasons: normalizedThresholds.reasons,
            });
          }

          return normalizedEvaluation;
        })
        .sort(compareRankedEvaluations);

      return ranked;
    } catch (error) {
      logger.error('Failed to rank results', { error: error.message });
      return evaluations;
    }
  }

  /**
   * Determine the classification action given a ranked list of evaluations.
   * Returns a normalised result object via policyDecisionBuilder.
   *
   * @param {object[]} ranked — output of rankResults()
   * @returns {object}
   */
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

      if (ambiguousTopCandidates.length > 1) {
        logger.info('Policy ranking is ambiguous; degrading to conservative selection', {
          topScore: top.score,
          closeScoreMargin: POLICY_CLOSE_SCORE_MARGIN,
          candidateCount: ambiguousTopCandidates.length,
          candidates: ambiguousTopCandidates.map((candidate) => ({
            policy_id: candidate.policy_id,
            library_id: candidate.library_id,
            score: candidate.score,
          })),
        });

        return policyDecisionBuilder.buildPolicyDecision({
          action: top.score >= POLICY_PROMPT_SELECT_MIN_CONFIDENCE ? 'prompt_select' : 'manual',
          top,
          ranked: normalizedRanked,
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

module.exports = new PolicyCandidateRanker();
module.exports.PolicyCandidateRanker = PolicyCandidateRanker;
module.exports.POLICY_PROMPT_SELECT_MIN_CONFIDENCE = POLICY_PROMPT_SELECT_MIN_CONFIDENCE;
module.exports.POLICY_CLOSE_SCORE_MARGIN = POLICY_CLOSE_SCORE_MARGIN;

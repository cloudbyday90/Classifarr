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

const logger = createLogger('PolicyCandidateRanker');

// Mirror the constant that governs the lowest score still worthy of a
// prompt_select decision. Must stay in sync with policyEngine.js.
const POLICY_PROMPT_SELECT_MIN_CONFIDENCE = 40;

class PolicyCandidateRanker {

  /**
   * Sort valid evaluations by score descending (zero-score entries removed).
   *
   * @param {object[]} evaluations — scored policy evaluation objects
   * @returns {Promise<object[]>}  ranked (descending) non-zero evaluations
   */
  async rankResults(evaluations) {
    try {
      const ranked = evaluations
        .filter(e => e.score > 0)
        .sort((a, b) => b.score - a.score);

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
      if (ranked.length === 0) {
        return policyDecisionBuilder.normalizeResult({
          action: 'manual',
          confidence: 0,
          ranked: []
        });
      }

      const top = ranked[0];

      if (top.score >= top.auto_classify_threshold) {
        return policyDecisionBuilder.buildPolicyDecision({
          action: 'auto_classify',
          top,
          ranked
        });
      }

      if (top.score >= top.prompt_threshold) {
        return policyDecisionBuilder.buildPolicyDecision({
          action: 'prompt_confirm',
          top,
          ranked
        });
      }

      if (top.score >= POLICY_PROMPT_SELECT_MIN_CONFIDENCE) {
        return policyDecisionBuilder.buildPolicyDecision({
          action: 'prompt_select',
          top,
          ranked
        });
      }

      return policyDecisionBuilder.buildPolicyDecision({
        action: 'manual',
        top,
        ranked
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

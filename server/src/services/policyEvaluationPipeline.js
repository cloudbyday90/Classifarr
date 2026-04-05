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
 * policyEvaluationPipeline.js
 *
 * Phase 3 PE-3 extraction: thin orchestration façade that defines the
 * stage interface for the full classification pipeline.  Each stage is a
 * named, independently-testable method so Phase 4 can inject new stages
 * (e.g. evidence-based scoring) without modifying policyEngine.js.
 *
 * Stages:
 *  1. loadPolicyCandidates  — fetch active policies + apply media-type filter
 *  2. buildSharedContext    — RAG prefetch (shared across all policy evaluations)
 *  3. evaluateAllPolicies   — score each candidate policy
 *  4. applyExclusions       — detect language conflicts, filter valid evaluations
 *  5. rankAndDecide         — sort + determine classification action
 *
 * policyEngine.js continues to own the full evaluateItem flow; this service
 * exposes the same logic as discrete, composable steps.
 */

const policyEngine = require('./policyEngine');
const ragRetriever = require('./ragRetriever');
const policyExclusionService = require('./policyExclusionService');
const policyCandidateRanker = require('./policyCandidateRanker');
const policyDecisionBuilder = require('./policyDecisionBuilder');
const { createLogger } = require('../utils/logger');

const logger = createLogger('PolicyEvaluationPipeline');

const DEFAULT_RAG_WEIGHT = 0.15;

class PolicyEvaluationPipeline {

  // ── Stage 1 ────────────────────────────────────────────────────────────────

  /**
   * Fetch all active policies and filter to candidates that are compatible
   * with the item's media_type.
   *
   * @param {object} item — media item (requires item.media_type)
   * @returns {Promise<{ policies: object[], candidatePolicies: object[], itemMediaType: string|null, skipped: number }>}
   */
  async loadPolicyCandidates(item) {
    const policies = await policyEngine.getActivePolicies();
    const itemMediaType = item.media_type?.toLowerCase() || null;
    const { candidatePolicies, skipped } = policyExclusionService.applyMediaTypeFilter(policies, itemMediaType);

    if (!itemMediaType) {
      logger.warn('Item missing media_type, evaluating against all policies', {
        title: item.title,
        totalPolicies: policies.length
      });
    } else {
      logger.info('Filtered policies by media_type', {
        title: item.title,
        mediaType: itemMediaType,
        totalPolicies: policies.length,
        candidatePolicies: candidatePolicies.length,
        skipped
      });
    }

    return { policies, candidatePolicies, itemMediaType, skipped };
  }

  // ── Stage 2 ────────────────────────────────────────────────────────────────

  /**
   * Build the shared RAG context for a batch of candidate policies.
   * Swallows RAG errors — a failed fetch degrades gracefully to an
   * empty cache rather than aborting classification.
   *
   * @param {object[]} candidatePolicies  — output of loadPolicyCandidates
   * @param {object}   item               — media item
   * @param {object}   [options]
   * @param {object}   [options.ragCache] — pre-built cache to bypass fetch
   * @returns {Promise<{ ragCache: { matches: object[], timestamp: number }, anyPolicyUsesRAG: boolean }>}
   */
  async buildSharedContext(candidatePolicies, item, options = {}) {
    const anyPolicyUsesRAG = candidatePolicies.some(
      p => p.trust_rag && (p.rag_weight ?? DEFAULT_RAG_WEIGHT) > 0
    );

    const normalizeCache = (cache) => {
      if (!cache || !Array.isArray(cache.matches)) {
        return { matches: [], timestamp: Date.now() };
      }
      return { matches: cache.matches, timestamp: cache.timestamp || Date.now() };
    };

    let ragCache = options.ragCache ? normalizeCache(options.ragCache) : null;

    if (!ragCache) {
      ragCache = { matches: [], timestamp: Date.now() };
      if (anyPolicyUsesRAG) {
        try {
          const ragMatches = await ragRetriever.semanticSearch(item, 5);
          ragCache = { matches: ragMatches, timestamp: Date.now() };
        } catch (error) {
          logger.debug('Failed to pre-fetch RAG matches', { error: error.message });
        }
      }
    }

    return { ragCache, anyPolicyUsesRAG };
  }

  // ── Stage 3 ────────────────────────────────────────────────────────────────

  /**
   * Score every candidate policy in sequence and collect raw evaluations.
   *
   * @param {object[]} candidatePolicies — output of loadPolicyCandidates
   * @param {object}   item              — media item
   * @param {object}   ragCache          — output of buildSharedContext
   * @returns {Promise<object[]>}         raw scored evaluation objects
   */
  async evaluateAllPolicies(candidatePolicies, item, ragCache) {
    const rawEvaluations = [];
    for (const policy of candidatePolicies) {
      const evaluation = await policyEngine.evaluatePolicy(policy, item, ragCache);
      rawEvaluations.push(evaluation);
    }
    return rawEvaluations;
  }

  // ── Stage 4 ────────────────────────────────────────────────────────────────

  /**
   * Detect strict language conflicts and filter to valid evaluations only.
   *
   * @param {object[]} candidatePolicies — output of loadPolicyCandidates
   * @param {object[]} rawEvaluations    — output of evaluateAllPolicies
   * @param {object}   item              — media item (uses item.original_language)
   * @returns {{ evaluations: object[], languageConflicts: object[], languageConflictPolicyIds: Set<number> }}
   */
  applyExclusions(candidatePolicies, rawEvaluations, item) {
    const itemLanguage = (item.original_language || '').toLowerCase();
    const { languageConflicts, languageConflictPolicyIds } =
      policyExclusionService.detectLanguageConflicts(candidatePolicies, rawEvaluations, itemLanguage);
    const evaluations = policyExclusionService.filterValidEvaluations(rawEvaluations, languageConflictPolicyIds);
    return { evaluations, languageConflicts, languageConflictPolicyIds };
  }

  // ── Stage 5 ────────────────────────────────────────────────────────────────

  /**
   * Sort valid evaluations and return a normalised classification decision.
   *
   * @param {object[]} evaluations        — output of applyExclusions
   * @param {object[]} languageConflicts  — output of applyExclusions
   * @param {boolean}  anyPolicyUsesRAG   — output of buildSharedContext
   * @param {object}   ragCache           — output of buildSharedContext
   * @returns {Promise<object>}            normalised result from policyDecisionBuilder
   */
  async rankAndDecide(evaluations, languageConflicts, anyPolicyUsesRAG, ragCache) {
    if (evaluations.length === 0) {
      logger.info('No policies matched after exclusion filters');
      return policyDecisionBuilder.normalizeResult({
        action: 'manual',
        confidence: 0,
        ranked: [],
        languageConflicts
      });
    }

    const ranked = await policyCandidateRanker.rankResults(evaluations);
    const result = policyCandidateRanker.determineAction(ranked);

    return policyDecisionBuilder.normalizeResult({
      ...result,
      languageConflicts,
      ragCache: anyPolicyUsesRAG ? ragCache : { matches: [], timestamp: Date.now() }
    });
  }
}

module.exports = new PolicyEvaluationPipeline();
module.exports.PolicyEvaluationPipeline = PolicyEvaluationPipeline;

/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { normalizeSignalConfig } from '../utils/policySignals.mjs';
import { mergePresetSignals } from '../utils/policySignals.mjs';
import { ragRetriever } from './ragRetriever.mjs';
import { policyDecisionBuilder } from './policyDecisionBuilder.mjs';
import { policyExclusionService } from './policyExclusionService.mjs';
import { policyCandidateRanker } from './policyCandidateRanker.mjs';

import { FORMULA_CONFIDENCE_CAP, DEFAULT_RAG_WEIGHT, normalizeCombinationMode, isPositiveContribution } from './policyEngineUtils.mjs';
import {
    scoreCertification, scoreGenres, scoreKeywords, scoreStudios,
    scoreReleaseYear, scoreVoteAverage, scoreRuntime, scoreLanguage,
    scoreMediaType, evaluatePresetSignals
} from './policyEngineSignalScoring.mjs';
import {
    calculateAgreementMultiplier, scorePresets, scorePatterns,
    scoreRelatedEvidence, scoreRAG, scoreHistory, scoreProfile
} from './policyEngineSourceScoring.mjs';

export { FORMULA_CONFIDENCE_CAP };
export {
    normalizePresetAttachmentWeight, parseFiniteNumber, hasConfiguredList,
    getCertificationOrder, isAlphaNumericBoundary, textContainsWholeTerm,
    keywordMatchesTerm, isPositiveContribution, normalizeCombinationMode,
    DEFAULT_RAG_WEIGHT, VALID_COMBINATION_MODES,
    MOVIE_CERTIFICATION_ORDER, TV_CERTIFICATION_ORDER
} from './policyEngineUtils.mjs';
export {
    scoreCertification, scoreGenres, scoreKeywords, scoreStudios,
    scoreReleaseYear, scoreVoteAverage, scoreRuntime, scoreLanguage,
    scoreMediaType, evaluatePresetSignals
} from './policyEngineSignalScoring.mjs';
export {
    calculateAgreementMultiplier, scorePresets, scorePatterns,
    scoreRelatedEvidence, scoreRAG, scoreHistory, scoreProfile
} from './policyEngineSourceScoring.mjs';

const logger = createLogger('PolicyEngine');

class PolicyEngine {
    normalizeCombinationMode(...args) { return normalizeCombinationMode(...args); }
    scoreCertification(...args) { return scoreCertification(...args); }
    scoreGenres(...args) { return scoreGenres(...args); }
    scoreKeywords(...args) { return scoreKeywords(...args); }
    scoreStudios(...args) { return scoreStudios(...args); }
    scoreReleaseYear(...args) { return scoreReleaseYear(...args); }
    scoreVoteAverage(...args) { return scoreVoteAverage(...args); }
    scoreRuntime(...args) { return scoreRuntime(...args); }
    scoreLanguage(...args) { return scoreLanguage(...args); }
    scoreMediaType(...args) { return scoreMediaType(...args); }
    evaluatePresetSignals(...args) { return evaluatePresetSignals(...args); }
    calculateAgreementMultiplier(...args) { return calculateAgreementMultiplier(...args); }
    async scorePresets(...args) { return scorePresets(...args); }
    async scorePatterns(...args) { return scorePatterns(...args); }
    async scoreRelatedEvidence(...args) { return scoreRelatedEvidence(...args); }
    async scoreRAG(...args) { return scoreRAG(...args); }
    async scoreHistory(...args) { return scoreHistory(...args); }
    async scoreProfile(...args) { return scoreProfile(...args); }

    async evaluateItem(item, options = {}) {
        try {
            logger.info('Evaluating item against policies', { title: item.title });

            const authoritativeMatch = await this.checkAuthoritativeSignals(item);
            if (authoritativeMatch) {
                logger.info('Authoritative signal matched', {
                    title: item.title,
                    library: authoritativeMatch.library_name,
                    confidence: authoritativeMatch.confidence
                });
                return policyDecisionBuilder.normalizeResult({
                    action: 'auto_classify',
                    library: authoritativeMatch,
                    confidence: authoritativeMatch.confidence,
                    method: authoritativeMatch.method,
                    ranked: [authoritativeMatch]
                });
            }

            const policies = await this.getActivePolicies();
            if (policies.length === 0) {
                logger.warn('No active policies found');
                return policyDecisionBuilder.normalizeResult({
                    action: 'manual',
                    confidence: 0,
                    ranked: []
                });
            }

            const itemMediaType = item.media_type?.toLowerCase();
            const { candidatePolicies, skipped: skippedPolicies } =
                policyExclusionService.applyMediaTypeFilter(policies, itemMediaType);

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
                    skippedPolicies
                });
            }

            if (candidatePolicies.length === 0) {
                logger.warn('No policies match item media_type', {
                    title: item.title,
                    mediaType: itemMediaType
                });
                return policyDecisionBuilder.normalizeResult({
                    action: 'manual',
                    confidence: 0,
                    ranked: []
                });
            }

            const normalizeRagCache = (cache) => {
                if (!cache || !Array.isArray(cache.matches)) {
                    return { matches: [], timestamp: Date.now() };
                }
                return {
                    matches: cache.matches,
                    timestamp: cache.timestamp || Date.now()
                };
            };

            let ragCache = options.ragCache ? normalizeRagCache(options.ragCache) : null;
            const relatedEvidence = Array.isArray(options.relatedEvidence) ? options.relatedEvidence : [];
            const anyPolicyUsesRAG = candidatePolicies.some(p => p.trust_rag && (p.rag_weight ?? DEFAULT_RAG_WEIGHT) > 0);
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

            const rawEvaluations = [];
            const itemLanguage = (item.original_language || '').toLowerCase();

            for (const policy of candidatePolicies) {
                const evaluation = await this.evaluatePolicy(policy, item, ragCache, relatedEvidence);
                rawEvaluations.push(evaluation);
            }

            const { languageConflicts, languageConflictPolicyIds } =
                policyExclusionService.detectLanguageConflicts(candidatePolicies, rawEvaluations, itemLanguage);

            const evaluations = policyExclusionService.filterValidEvaluations(
                rawEvaluations, languageConflictPolicyIds
            );

            if (evaluations.length === 0) {
                logger.info('No policies matched', { title: item.title });
                return policyDecisionBuilder.normalizeResult({
                    action: 'manual',
                    confidence: 0,
                    ranked: [],
                    languageConflicts,
                });
            }

            const ranked = await policyCandidateRanker.rankResults(evaluations);

            const result = policyCandidateRanker.determineAction(ranked);

            logger.info('Policy evaluation complete', {
                title: item.title,
                action: result.action,
                topLibrary: result.library?.library_name,
                topScore: result.confidence,
                languageConflictCount: languageConflicts.length,
            });

            return policyDecisionBuilder.normalizeResult({
                ...result,
                languageConflicts,
                ragCache: anyPolicyUsesRAG ? ragCache : { matches: [], timestamp: Date.now() }
            });

        } catch (error) {
            logger.error('Failed to evaluate item', {
                error: error.message,
                title: item?.title
            });
            throw error;
        }
    }

    async checkAuthoritativeSignals(item) {
        try {
            if (!item.source_library_id) {
                return null;
            }

            const result = await db.query(`
                SELECT 
                    lp.id as policy_id,
                    lp.library_id,
                    lp.name as policy_name,
                    l.id as library_id,
                    l.name as library_name
                FROM library_policies lp
                JOIN libraries l ON lp.library_id = l.id
                WHERE lp.enabled = true
                AND lp.source_library_ids::jsonb ? $1
                ORDER BY lp.priority DESC
                LIMIT 1
            `, [item.source_library_id]);

            if (result.rows.length === 0) {
                return null;
            }

            const match = result.rows[0];
            return {
                library_id: match.library_id,
                library_name: match.library_name,
                policy_id: match.policy_id,
                policy_name: match.policy_name,
                confidence: 100,
                method: 'authoritative_source_library',
                reason: `Matched source library: ${item.source_library_name || item.source_library_id}`
            };

        } catch (error) {
            logger.error('Failed to check authoritative signals', { error: error.message });
            return null;
        }
    }

    async getActivePolicies() {
        try {
            const result = await db.query(`
                SELECT 
                    lp.id,
                    lp.library_id,
                    lp.name,
                    lp.enabled,
                    lp.priority,
                    lp.auto_classify_threshold,
                    lp.prompt_threshold,
                    lp.trust_patterns,
                    lp.trust_rag,
                    lp.trust_history,
                    lp.combination_mode,
                    lp.preset_weight,
                    lp.profile_weight,
                    lp.pattern_weight,
                    lp.rag_weight,
                    lp.history_weight,
                    l.name as library_name,
                    l.media_type as library_media_type
                FROM library_policies lp
                JOIN libraries l ON lp.library_id = l.id
                WHERE lp.enabled = true
                AND l.is_active = true
                ORDER BY lp.priority DESC, lp.sort_order ASC
            `);

            const policies = [];
            for (const policy of result.rows) {
                const presetsResult = await db.query(`
                    SELECT 
                        cp.id,
                        cp.key,
                        cp.name,
                        cp.signals,
                        pp.weight,
                        pp.custom_signals
                    FROM policy_presets pp
                    JOIN content_presets cp ON pp.preset_id = cp.id
                    WHERE pp.policy_id = $1
                `, [policy.id]);

                policy.presets = presetsResult.rows.map(preset => {
                    const baseSignals = normalizeSignalConfig(preset.signals);
                    const customSignals = normalizeSignalConfig(preset.custom_signals);
                    return {
                        ...preset,
                        signals: mergePresetSignals(baseSignals, customSignals),
                        custom_signals: customSignals
                    };
                });
                policies.push(policy);
            }

            logger.debug('Retrieved active policies', { count: policies.length });
            return policies;

        } catch (error) {
            logger.error('Failed to get active policies', { error: error.message });
            return [];
        }
    }

    async evaluatePolicy(policy, item, ragCache = { matches: [], timestamp: Date.now() }, relatedEvidence = []) {
        try {
            const scores = {
                preset: 0,
                pattern: 0,
                rag: 0,
                history: 0,
                profile: 0
            };

            if (policy.presets && policy.presets.length > 0) {
                scores.preset = await this.scorePresets(policy.presets, item, policy.combination_mode);
            }

            scores.profile = await this.scoreProfile(policy.library_id, item);

            if (policy.trust_patterns) {
                if (relatedEvidence.length > 0) {
                    scores.pattern = await this.scoreRelatedEvidence(policy.library_id, relatedEvidence);
                    logger.debug('Pattern scored via related evidence (Phase 4)', {
                        library_id: policy.library_id,
                        evidenceCount: relatedEvidence.length,
                        patternScore: scores.pattern,
                    });
                } else {
                    scores.pattern = await this.scorePatterns(policy.library_id, item);
                    logger.debug('Pattern scored via legacy patterns (no related evidence)', {
                        library_id: policy.library_id,
                        patternScore: scores.pattern,
                    });
                }
            }

            if (policy.trust_rag) {
                scores.rag = await this.scoreRAG(policy.library_id, item, ragCache);
            }

            if (policy.trust_history) {
                scores.history = await this.scoreHistory(policy.library_id, item);
            }

            const weights = {
                preset: policy.preset_weight ?? 0.35,
                profile: policy.profile_weight ?? 0.25,
                pattern: policy.pattern_weight ?? 0.15,
                rag: policy.rag_weight ?? 0.15,
                history: policy.history_weight ?? 0.10
            };

            const effectiveWeights = {
                preset: isPositiveContribution(scores.preset) ? weights.preset : 0,
                profile: isPositiveContribution(scores.profile) ? weights.profile : 0,
                pattern: policy.trust_patterns && isPositiveContribution(scores.pattern) ? weights.pattern : 0,
                rag: policy.trust_rag && isPositiveContribution(scores.rag) ? weights.rag : 0,
                history: policy.trust_history && isPositiveContribution(scores.history) ? weights.history : 0
            };

            const breakdown = [
                { type: 'preset', score: scores.preset, weight: weights.preset, activeWeight: effectiveWeights.preset },
                { type: 'profile', score: scores.profile, weight: weights.profile, activeWeight: effectiveWeights.profile },
                { type: 'pattern', score: scores.pattern, weight: weights.pattern, activeWeight: effectiveWeights.pattern },
                { type: 'rag', score: scores.rag, weight: weights.rag, activeWeight: effectiveWeights.rag },
                { type: 'history', score: scores.history, weight: weights.history, activeWeight: effectiveWeights.history }
            ];

            const weightedScore = 
                (scores.preset * effectiveWeights.preset) +
                (scores.profile * effectiveWeights.profile) +
                (scores.pattern * effectiveWeights.pattern) +
                (scores.rag * effectiveWeights.rag) +
                (scores.history * effectiveWeights.history);

            const totalWeight =
                effectiveWeights.preset +
                effectiveWeights.profile +
                effectiveWeights.pattern +
                effectiveWeights.rag +
                effectiveWeights.history;
            const finalScore = totalWeight > 0 ? (weightedScore / totalWeight) : 0;

            const agreement = this.calculateAgreementMultiplier(scores, policy);
            const boostedScore = Math.min(finalScore * agreement.multiplier, FORMULA_CONFIDENCE_CAP);

            return {
                policy_id: policy.id,
                policy_name: policy.name,
                library_id: policy.library_id,
                library_name: policy.library_name,
                score: Math.round(boostedScore * 100) / 100,
                scores,
                weights,
                breakdown,
                agreement,
                combination_mode: this.normalizeCombinationMode(policy.combination_mode),
                auto_classify_threshold: policy.auto_classify_threshold,
                prompt_threshold: policy.prompt_threshold
            };

        } catch (error) {
            logger.error('Failed to evaluate policy', {
                error: error.message,
                policy: policy.name
            });
            return {
                policy_id: policy.id,
                policy_name: policy.name,
                library_id: policy.library_id,
                library_name: policy.library_name,
                score: 0,
                scores: { preset: 0, profile: 0, pattern: 0, rag: 0, history: 0 },
                weights: { preset: 0, profile: 0, pattern: 0, rag: 0, history: 0 },
                breakdown: []
            };
        }
    }
}

export const policyEngine = new PolicyEngine();

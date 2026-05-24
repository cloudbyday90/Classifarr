import { createLogger } from '../utils/logger.mjs';
import { ragRetriever } from './ragRetriever.mjs';
import { policyDecisionBuilder } from './policyDecisionBuilder.mjs';
import { policyExclusionService } from './policyExclusionService.mjs';
import { policyCandidateRanker } from './policyCandidateRanker.mjs';
import { buildCandidateDiagnostics } from './policyCandidateDiagnostics.mjs';

import { FORMULA_CONFIDENCE_CAP, DEFAULT_RAG_WEIGHT, normalizeCombinationMode, isPositiveContribution } from './policyEngineUtils.mjs';
import { calculateAgreementMultiplier, scoreRelatedEvidence } from './policyEngineSourceScoring.mjs';

const logger = createLogger('PolicyEngine');

export async function evaluateItem(item, options, deps) {
    const { checkAuthoritativeSignals, getActivePolicies, evaluatePolicy } = deps;

    try {
        logger.info('Evaluating item against policies', { title: item.title });

        const authoritativeMatch = await checkAuthoritativeSignals(item);
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

        const policies = await getActivePolicies();
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
            const evaluation = await evaluatePolicy(policy, item, ragCache, relatedEvidence);
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

export async function evaluatePolicy(policy, item, ragCache, relatedEvidence, deps) {
    const { scorePresets, scoreProfile, scorePatterns, scoreRAG, scoreHistory } = deps;

    try {
        const scores = {
            preset: 0,
            pattern: 0,
            rag: 0,
            history: 0,
            profile: 0
        };

        if (policy.presets && policy.presets.length > 0) {
            scores.preset = await scorePresets(policy.presets, item, policy.combination_mode);
        }

        scores.profile = await scoreProfile(policy.library_id, item);

        if (policy.trust_patterns) {
            if (relatedEvidence.length > 0) {
                scores.pattern = await scoreRelatedEvidence(policy.library_id, relatedEvidence);
                logger.debug('Pattern scored via related evidence (Phase 4)', {
                    library_id: policy.library_id,
                    evidenceCount: relatedEvidence.length,
                    patternScore: scores.pattern,
                });
            } else {
                scores.pattern = await scorePatterns(policy.library_id, item);
                logger.debug('Pattern scored via legacy patterns (no related evidence)', {
                    library_id: policy.library_id,
                    patternScore: scores.pattern,
                });
            }
        }

        if (policy.trust_rag) {
            scores.rag = await scoreRAG(policy.library_id, item, ragCache);
        }

        if (policy.trust_history) {
            scores.history = await scoreHistory(policy.library_id, item);
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

        const agreement = calculateAgreementMultiplier(scores, policy);
        const boostedScore = Math.min(finalScore * agreement.multiplier, FORMULA_CONFIDENCE_CAP);
        const candidateDiagnostics = buildCandidateDiagnostics(policy, scores, agreement);

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
            candidate_diagnostics: candidateDiagnostics,
            combination_mode: normalizeCombinationMode(policy.combination_mode),
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

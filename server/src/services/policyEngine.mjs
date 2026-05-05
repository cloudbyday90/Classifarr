/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import db from '../config/database.mjs';
import { patternSignalCollector } from './patternSignalCollector.mjs';
import ragRetriever from './ragRetriever.mjs';
import libraryProfileService from './libraryProfileService.mjs';
import policyDecisionBuilder from './policyDecisionBuilder.mjs';
import policyExclusionService from './policyExclusionService.mjs';
import policyCandidateRanker from './policyCandidateRanker.mjs';
import { createLogger } from '../utils/logger.mjs';
import { mergePresetSignals, normalizeSignalConfig } from '../utils/policySignals.mjs';
import { normalizeMetadataListLower } from '../utils/metadataNormalization.mjs';

const logger = createLogger('PolicyEngine');

const FORMULA_CONFIDENCE_CAP = 95;
const MOVIE_CERTIFICATION_ORDER = ['G', 'PG', 'PG-13', 'R', 'NC-17'];
const TV_CERTIFICATION_ORDER = ['TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'];

const DEFAULT_RAG_WEIGHT = 0.15;
const VALID_COMBINATION_MODES = new Set(['best_match', 'average', 'weighted_average', 'require_all']);

function normalizePresetAttachmentWeight(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 1.0;
}

function parseFiniteNumber(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const trimmedValue = value.trim();
    if (trimmedValue.length === 0) {
        return null;
    }

    const numeric = Number(trimmedValue);
    return Number.isFinite(numeric) ? numeric : null;
}

function hasConfiguredList(values) {
    return Array.isArray(values) && values.length > 0;
}

function getCertificationOrder(value) {
    const certification = String(value || '').toUpperCase();

    if (MOVIE_CERTIFICATION_ORDER.includes(certification)) {
        return MOVIE_CERTIFICATION_ORDER;
    }

    if (TV_CERTIFICATION_ORDER.includes(certification)) {
        return TV_CERTIFICATION_ORDER;
    }

    return null;
}

function isAlphaNumericBoundary(text, index) {
    if (index < 0 || index >= text.length) {
        return true;
    }

    return !/[\p{L}\p{N}]/u.test(text[index]);
}

function textContainsWholeTerm(searchableText, normalizedTerm) {
    let matchIndex = searchableText.indexOf(normalizedTerm);

    while (matchIndex !== -1) {
        const beforeIndex = matchIndex - 1;
        const afterIndex = matchIndex + normalizedTerm.length;

        if (
            isAlphaNumericBoundary(searchableText, beforeIndex)
            && isAlphaNumericBoundary(searchableText, afterIndex)
        ) {
            return true;
        }

        matchIndex = searchableText.indexOf(normalizedTerm, matchIndex + 1);
    }

    return false;
}

function keywordMatchesTerm(term, keywordList, searchableText) {
    const normalizedTerm = String(term || '').trim().toLowerCase();
    if (!normalizedTerm) {
        return false;
    }

    if (keywordList.includes(normalizedTerm)) {
        return true;
    }

    return textContainsWholeTerm(searchableText, normalizedTerm);
}

function isPositiveContribution(score) {
    return Number.isFinite(score) && score > 0;
}

class PolicyEngine {
    normalizeCombinationMode(mode) {
        return VALID_COMBINATION_MODES.has(mode) ? mode : 'best_match';
    }

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

    calculateAgreementMultiplier(scores, policy) {
        let contributing = 0;
        if ((policy.presets && policy.presets.length > 0) && scores.preset > 0) contributing++;
        if (scores.profile > 0) contributing++;
        if (policy.trust_patterns && scores.pattern > 0) contributing++;
        if (policy.trust_rag && scores.rag > 0) contributing++;
        if (policy.trust_history && scores.history > 0) contributing++;

        const AGREEMENT_MULTIPLIERS = [1.0, 1.0, 1.05, 1.12, 1.20, 1.30];
        const multiplier = AGREEMENT_MULTIPLIERS[Math.min(contributing, AGREEMENT_MULTIPLIERS.length - 1)];

        return { multiplier, contributing };
    }

    async scorePresets(presets, item, combinationMode = 'best_match') {
        try {
            if (!presets || presets.length === 0) {
                return 0;
            }

            const normalizedMode = this.normalizeCombinationMode(combinationMode);
            const presetScores = [];

            for (const preset of presets) {
                const presetWeight = normalizePresetAttachmentWeight(preset.weight);
                const mergedSignals = mergePresetSignals(
                    normalizeSignalConfig(preset.signals),
                    normalizeSignalConfig(preset.custom_signals)
                );
                const signalScore = await this.evaluatePresetSignals(mergedSignals, item);

                presetScores.push({
                    score: signalScore,
                    weight: presetWeight
                });
            }

            if (presetScores.length === 0) {
                return 0;
            }

            if (normalizedMode === 'best_match') {
                return Math.min(
                    Math.max(...presetScores.map((preset) => preset.score)),
                    FORMULA_CONFIDENCE_CAP
                );
            }

            if (normalizedMode === 'average') {
                const totalScore = presetScores.reduce((sum, preset) => sum + preset.score, 0);
                return Math.min(totalScore / presetScores.length, FORMULA_CONFIDENCE_CAP);
            }

            if (normalizedMode === 'require_all' && presetScores.some((preset) => preset.score <= 0)) {
                return 0;
            }

            const totalScore = presetScores.reduce(
                (sum, preset) => sum + (preset.score * preset.weight),
                0
            );
            const totalWeight = presetScores.reduce((sum, preset) => sum + preset.weight, 0);
            const finalScore = totalWeight > 0 ? (totalScore / totalWeight) : 0;
            
            return Math.min(finalScore, FORMULA_CONFIDENCE_CAP);

        } catch (error) {
            logger.error('Failed to score presets', { error: error.message });
            return 0;
        }
    }

    async evaluatePresetSignals(signals, item) {
        try {
            if (!signals) {
                return 0;
            }

            const scores = [];
            let totalWeight = 0;

            if (signals.certifications) {
                const score = this.scoreCertification(signals.certifications, item);
                const weight = signals.certifications.weight ?? 1.0;
                scores.push(score * weight);
                totalWeight += weight;
            }

            if (signals.genres) {
                const score = this.scoreGenres(signals.genres, item);
                const weight = signals.genres.weight ?? 1.0;
                scores.push(score * weight);
                totalWeight += weight;
            }

            if (signals.keywords) {
                const score = this.scoreKeywords(signals.keywords, item);
                const weight = signals.keywords.weight ?? 1.0;
                scores.push(score * weight);
                totalWeight += weight;
            }

            if (signals.studios) {
                const score = this.scoreStudios(signals.studios, item);
                const weight = signals.studios.weight ?? 1.0;
                scores.push(score * weight);
                totalWeight += weight;
            }

            if (signals.release_year) {
                const score = this.scoreReleaseYear(signals.release_year, item);
                const weight = signals.release_year.weight ?? 1.0;
                scores.push(score * weight);
                totalWeight += weight;
            }

            if (signals.vote_average) {
                const score = this.scoreVoteAverage(signals.vote_average, item);
                const weight = signals.vote_average.weight ?? 1.0;
                scores.push(score * weight);
                totalWeight += weight;
            }

            if (signals.runtime) {
                const score = this.scoreRuntime(signals.runtime, item);
                const weight = signals.runtime.weight ?? 1.0;
                scores.push(score * weight);
                totalWeight += weight;
            }

            if (signals.language) {
                const score = this.scoreLanguage(signals.language, item);
                if (score === 0 && policyExclusionService.hasStrictSignalConstraint(signals.language)) {
                    return 0;
                }
                const weight = signals.language.weight ?? 1.0;
                scores.push(score * weight);
                totalWeight += weight;
            }

            if (signals.media_type) {
                const score = this.scoreMediaType(signals.media_type, item);
                if (score === 0) {
                    return 0;
                }
                const weight = signals.media_type.weight ?? 1.0;
                scores.push(score * weight);
                totalWeight += weight;
            }

            if (totalWeight === 0) {
                return 0;
            }

            const totalScore = scores.reduce((sum, s) => sum + s, 0);
            return totalScore / totalWeight;

        } catch (error) {
            logger.error('Failed to evaluate preset signals', { error: error.message });
            return 0;
        }
    }

    scoreCertification(config, item) {
        try {
            const cert = item.certification?.toUpperCase();
            if (!cert) return 0;

            if (config.mode === 'include') {
                const included = (config.include || []).map(c => c.toUpperCase());
                return included.includes(cert) ? 100 : 0;
            }

            if (config.mode === 'exclude') {
                const excluded = (config.exclude || []).map(c => c.toUpperCase());
                return excluded.includes(cert) ? 0 : 100;
            }

            if (config.mode === 'max') {
                const maxCert = config.max?.toUpperCase();
                const maxOrder = getCertificationOrder(maxCert);
                const itemOrder = getCertificationOrder(cert);
                
                if (!maxOrder || !itemOrder || maxOrder !== itemOrder) return 50;

                const maxIndex = maxOrder.indexOf(maxCert);
                const itemIndex = itemOrder.indexOf(cert);
                return itemIndex <= maxIndex ? 100 : 0;
            }

            return 0;
        } catch (_error) {
            return 0;
        }
    }

    scoreGenres(config, item) {
        try {
            const genres = normalizeMetadataListLower(item.genres);
            if (genres.length === 0) {
                return hasConfiguredList(config.require_all) || hasConfiguredList(config.require_any)
                    ? 0
                    : 50;
            }

            let score = 50;

            if (config.require_all && config.require_all.length > 0) {
                const allPresent = config.require_all.every(g => 
                    genres.includes(g.toLowerCase())
                );
                if (!allPresent) return 0;
                score = 100;
            }

            if (config.require_any && config.require_any.length > 0) {
                const anyPresent = config.require_any.some(g => 
                    genres.includes(g.toLowerCase())
                );
                if (!anyPresent) return 0;
                score = Math.max(score, 80);
            }

            if (config.prefer && config.prefer.length > 0) {
                const matchCount = config.prefer.filter(g => 
                    genres.includes(g.toLowerCase())
                ).length;
                const matchPercent = matchCount / config.prefer.length;
                score = Math.max(score, 50 + (matchPercent * 30));
            }

            if (config.exclude && config.exclude.length > 0) {
                const hasExcluded = config.exclude.some(g => 
                    genres.includes(g.toLowerCase())
                );
                if (hasExcluded) return 0;
            }

            return score;
        } catch (_error) {
            return 0;
        }
    }

    scoreKeywords(config, item) {
        try {
            const keywords = normalizeMetadataListLower(item.keywords);
            const overview = (item.overview || '').toLowerCase();
            const title = (item.title || '').toLowerCase();
            
            const searchableText = [overview, title].filter(Boolean).join(' ');

            let score = 50;

            if (config.require_any && config.require_any.length > 0) {
                const anyPresent = config.require_any.some(k => 
                    keywordMatchesTerm(k, keywords, searchableText)
                );
                if (!anyPresent) return 0;
                score = 80;
            }

            if (config.prefer && config.prefer.length > 0) {
                const matchCount = config.prefer.filter(k => 
                    keywordMatchesTerm(k, keywords, searchableText)
                ).length;
                const matchPercent = matchCount / config.prefer.length;
                score = Math.max(score, 50 + (matchPercent * 30));
            }

            if (config.exclude && config.exclude.length > 0) {
                const hasExcluded = config.exclude.some(k => 
                    keywordMatchesTerm(k, keywords, searchableText)
                );
                if (hasExcluded) return 0;
            }

            return score;
        } catch (_error) {
            return 0;
        }
    }

    scoreStudios(config, item) {
        try {
            const studiosArray =
                typeof item?.studios === 'string'
                    ? JSON.parse(item.studios)
                    : typeof item?.production_companies === 'string'
                        ? JSON.parse(item.production_companies)
                        : (item.studios || item.production_companies || []);

            const studios = studiosArray
                .map(s => (typeof s === 'string' ? s : s && s.name))
                .filter(Boolean)
                .map(s => s.toLowerCase());

            if (studios.length === 0) {
                if (config.require_any && config.require_any.length > 0) return 0;
                return 50;
            }

            let score = 50;

            if (config.require_any && config.require_any.length > 0) {
                const anyPresent = config.require_any.some(s => 
                    studios.some(studio => studio.includes(s.toLowerCase()))
                );
                if (!anyPresent) return 0;
                score = 80;
            }

            if (config.prefer && config.prefer.length > 0) {
                const matchCount = config.prefer.filter(s => 
                    studios.some(studio => studio.includes(s.toLowerCase()))
                ).length;
                const matchPercent = matchCount / config.prefer.length;
                score = Math.max(score, 50 + (matchPercent * 30));
            }

            return score;
        } catch (_error) {
            return 0;
        }
    }

    scoreReleaseYear(config, item) {
        try {
            const year = parseFiniteNumber(item.year);
            if (year === null) return 50;

            const min = parseFiniteNumber(config.min);
            const max = parseFiniteNumber(config.max);

            if (min !== null && year < min) return 0;
            if (max !== null && year > max) return 0;

            if (min !== null && max !== null) {
                return 100;
            } else if (min !== null || max !== null) {
                return 80;
            }

            return 50;
        } catch (_error) {
            return 0;
        }
    }

    scoreVoteAverage(config, item) {
        try {
            const rating = parseFiniteNumber(item.rating) ?? parseFiniteNumber(item.vote_average);
            if (rating === null) return 50;

            const min = parseFiniteNumber(config.min);
            const max = parseFiniteNumber(config.max);

            if (min !== null && rating < min) return 0;
            if (max !== null && rating > max) return 0;

            if (min !== null && max !== null) {
                return 100;
            } else if (min !== null || max !== null) {
                return 80;
            }

            return 50;
        } catch (_error) {
            return 0;
        }
    }

    scoreRuntime(config, item) {
        try {
            const runtime = parseFiniteNumber(item.runtime);
            if (runtime === null) return 50;

            const min = parseFiniteNumber(config.min_minutes);
            const max = parseFiniteNumber(config.max_minutes);

            if (min !== null && runtime < min) return 0;
            if (max !== null && runtime > max) return 0;

            if (min !== null && max !== null) {
                return 100;
            } else if (min !== null || max !== null) {
                return 80;
            }

            return 50;
        } catch (_error) {
            return 0;
        }
    }

    scoreLanguage(config, item) {
        try {
            const lang = (item.original_language || '').toLowerCase();
            if (!lang) return 50;

            let score = 50;

            if (config.require_any && config.require_any.length > 0) {
                const anyPresent = config.require_any.some(l => 
                    l.toLowerCase() === lang
                );
                if (!anyPresent) return 0;
                score = 80;
            }

            if (config.prefer && config.prefer.length > 0) {
                const isPreferred = config.prefer.some(l => 
                    l.toLowerCase() === lang
                );
                if (isPreferred) {
                    score = Math.max(score, 90);
                }
            }

            if (config.exclude && config.exclude.length > 0) {
                const isExcluded = config.exclude.some(l => 
                    l.toLowerCase() === lang
                );
                if (isExcluded) return 0;
            }

            return score;
        } catch (_error) {
            return 0;
        }
    }

    scoreMediaType(config, item) {
        try {
            const mediaType = item.media_type?.toLowerCase();
            if (!mediaType) return 50;

            const included = (config.include || []).map(t => t.toLowerCase());
            return included.includes(mediaType) ? 100 : 0;
        } catch (_error) {
            return 0;
        }
    }

    async scorePatterns(libraryId, item) {
        try {
            const signals = await patternSignalCollector.collectSignals(item, 0);
            
            if (!signals || signals.length === 0) {
                return 0;
            }

            const librarySignals = signals.filter(s => s.library?.id === libraryId);
            
            if (librarySignals.length === 0) {
                return 0;
            }

            const topSignal = librarySignals[0];
            return Math.min(topSignal.confidence, FORMULA_CONFIDENCE_CAP);

        } catch (error) {
            logger.debug('Failed to score patterns', { error: error.message });
            return 0;
        }
    }

    async scoreRelatedEvidence(libraryId, relatedEvidence) {
        try {
            if (!Array.isArray(relatedEvidence) || relatedEvidence.length === 0) {
                return 0;
            }
            const libraryEvidence = relatedEvidence.filter(e => e.libraryId === libraryId);
            if (libraryEvidence.length === 0) {
                return 0;
            }
            return Math.min(libraryEvidence[0].confidence ?? 0, FORMULA_CONFIDENCE_CAP);
        } catch (error) {
            logger.debug('Failed to score related evidence', { error: error.message });
            return 0;
        }
    }

    async scoreRAG(libraryId, item, ragCache = { matches: [], timestamp: Date.now() }) {
        try {
            const matches = ragCache?.matches || [];
            
            if (!matches || matches.length === 0) {
                return 0;
            }

            const libraryMatches = matches.filter(m => m.libraryId === libraryId);
            
            if (libraryMatches.length === 0) {
                return 0;
            }

            const topMatch = libraryMatches[0];
            return Math.min(topMatch.similarity * 100, FORMULA_CONFIDENCE_CAP);

        } catch (error) {
            logger.debug('Failed to score RAG', { error: error.message });
            return 0;
        }
    }

    async scoreHistory(libraryId, item) {
        try {
            const result = await db.query(`
                SELECT 
                    library_id,
                    MAX(confidence) AS confidence,
                    COUNT(*) as match_count
                FROM classification_history
                WHERE tmdb_id = $1
                AND status = 'completed'
                AND library_id IS NOT NULL
                GROUP BY library_id
                ORDER BY match_count DESC, confidence DESC
                LIMIT 5
            `, [item.tmdb_id]);

            if (result.rows.length === 0) {
                return 0;
            }

            const libraryMatch = result.rows.find(r => r.library_id === libraryId);
            
            if (!libraryMatch) {
                return 0;
            }

            const matchCount = parseInt(libraryMatch.match_count);
            const historicalConfidence = parseFloat(libraryMatch.confidence);
            
            const countBoost = Math.min(matchCount * 10, 40);
            const baseScore = Math.min(historicalConfidence, 60);
            
            return Math.min(baseScore + countBoost, FORMULA_CONFIDENCE_CAP);

        } catch (error) {
            logger.debug('Failed to score history', { error: error.message });
            return 0;
        }
    }

    async scoreProfile(libraryId, item) {
        try {
            const profileScore = await libraryProfileService.getProfileScore(libraryId, item);
            
            let finalScore = 0;
            if (profileScore > 50) {
                const scaledScore = ((profileScore - 50) / 50) * FORMULA_CONFIDENCE_CAP;
                finalScore = Math.max(0, Math.min(scaledScore, FORMULA_CONFIDENCE_CAP));
            }
            
            logger.debug('Profile score calculated', {
                libraryId,
                title: item.title,
                rawScore: profileScore,
                finalScore
            });
            
            return finalScore;

        } catch (error) {
            logger.error('Failed to score profile', { 
                error: error.message,
                libraryId,
                title: item.title
            });
            return 0;
        }
    }


}

export { FORMULA_CONFIDENCE_CAP };
export default new PolicyEngine();

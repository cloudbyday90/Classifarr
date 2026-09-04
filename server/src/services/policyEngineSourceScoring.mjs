/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { createLogger } from '../utils/logger.mjs';
import { mergePresetSignals, normalizeSignalConfig } from '../utils/policySignals.mjs';
import { patternSignalCollector } from './patternSignalCollector.mjs';
import { libraryProfileService } from './libraryProfileService.mjs';
import { evaluatePresetSignals } from './policyEngineSignalScoring.mjs';
import {
    FORMULA_CONFIDENCE_CAP,
    normalizePresetAttachmentWeight,
    normalizeCombinationMode
} from './policyEngineUtils.mjs';
import { scoreRagEvidenceForLibrary } from './ragEvidenceQualityGate.mjs';

export { scoreHistory } from './policyHistoryScoring.mjs';

const logger = createLogger('PolicyEngine');

export function calculateAgreementMultiplier(scores, policy) {
    let contributing = 0;
    const usesNativeIntent = policy?.policy_runtime_authority?.sourceId === 'native_intent';
    if (usesNativeIntent && scores.intent > 0) contributing++;
    if (!usesNativeIntent && (policy.presets && policy.presets.length > 0) && scores.preset > 0) contributing++;
    if (scores.profile > 0) contributing++;
    if (policy.trust_patterns && scores.pattern > 0) contributing++;
    if (policy.trust_rag && scores.rag > 0) contributing++;
    if (policy.trust_history && scores.history > 0) contributing++;

    const AGREEMENT_MULTIPLIERS = [1.0, 1.0, 1.05, 1.12, 1.20, 1.30];
    const multiplier = AGREEMENT_MULTIPLIERS[Math.min(contributing, AGREEMENT_MULTIPLIERS.length - 1)];

    return { multiplier, contributing };
}

export async function scorePresets(presets, item, combinationMode = 'best_match') {
    try {
        if (!presets || presets.length === 0) {
            return 0;
        }

        const normalizedMode = normalizeCombinationMode(combinationMode);
        const presetScores = [];

        for (const preset of presets) {
            const presetWeight = normalizePresetAttachmentWeight(preset.weight);
            const mergedSignals = mergePresetSignals(
                normalizeSignalConfig(preset.signals),
                normalizeSignalConfig(preset.custom_signals)
            );
            const signalScore = await evaluatePresetSignals(mergedSignals, item);

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

export async function scorePatterns(libraryId, item) {
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

export async function scoreRelatedEvidence(libraryId, relatedEvidence) {
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

export async function scoreRAGWithDiagnostics(libraryId, item, ragCache = { matches: [], timestamp: Date.now() }, options = {}) {
    try {
        const matches = ragCache?.matches || [];
        
        if (!matches || matches.length === 0) {
            return {
                score: 0,
                diagnostics: {
                    schema_version: 1,
                    library_id: libraryId,
                    considered_count: 0,
                    eligible_count: 0,
                    score: 0,
                    reasons: ['no_rag_matches'],
                    top_match: null,
                    matches: [],
                },
            };
        }

        return scoreRagEvidenceForLibrary({
            libraryId,
            matches,
            profileDiagnostics: options.profileDiagnostics || null,
        });

    } catch (error) {
        logger.debug('Failed to score RAG', { error: error.message });
        return {
            score: 0,
            diagnostics: {
                schema_version: 1,
                library_id: libraryId,
                considered_count: 0,
                eligible_count: 0,
                score: 0,
                reasons: ['rag_scoring_error'],
                top_match: null,
                matches: [],
            },
        };
    }
}

export async function scoreRAG(libraryId, item, ragCache = { matches: [], timestamp: Date.now() }) {
    const result = await scoreRAGWithDiagnostics(libraryId, item, ragCache);
    return result.score;
}

export async function scoreProfile(libraryId, item) {
    const result = await scoreProfileWithDiagnostics(libraryId, item);
    return result.score;
}

export async function scoreProfileWithDiagnostics(libraryId, item) {
    try {
        const profileDetails = typeof libraryProfileService.getProfileScoreDetails === 'function'
            ? await libraryProfileService.getProfileScoreDetails(libraryId, item)
            : { finalScore: await libraryProfileService.getProfileScore(libraryId, item), diagnostics: null };
        const profileScore = typeof profileDetails === 'number' ? profileDetails : profileDetails.finalScore;
        
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
        
        return {
            score: finalScore,
            diagnostics: profileDetails?.diagnostics || null,
        };

    } catch (error) {
        logger.error('Failed to score profile', { 
            error: error.message,
            libraryId,
            title: item.title
        });
        return {
            score: 0,
            diagnostics: {
                schema_version: 1,
                available: false,
                reason: 'profile_scoring_error',
            },
        };
    }
}

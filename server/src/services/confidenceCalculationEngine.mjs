import { SIGNAL_TYPES } from './signalCollector.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
    PROFILE_SCORE_NEUTRAL_BASELINE,
    parseConfiguredNumber,
    getLibraryConflictKey,
    compareLibraries,
    normalizeNumericPrecision
} from './confidenceCalculationUtils.mjs';

const logger = createLogger('ConfidenceCalculationEngine');

export function normalizeSignalScore(signal) {
    const parsedRawScore = parseConfiguredNumber(signal?.rawScore);
    if (parsedRawScore === null) {
        return 0;
    }

    const clampedRawScore = Math.min(100, Math.max(0, parsedRawScore));
    if (signal?.type !== SIGNAL_TYPES.PROFILE_SCORE) {
        return clampedRawScore;
    }

    if (clampedRawScore <= PROFILE_SCORE_NEUTRAL_BASELINE) {
        return 0;
    }

    return ((clampedRawScore - PROFILE_SCORE_NEUTRAL_BASELINE) / (100 - PROFILE_SCORE_NEUTRAL_BASELINE)) * 100;
}

export function calculate(signals, { weights: _weights, threshold, getWeight }) {
    if (!signals || signals.length === 0) {
        return {
            confidence: 0,
            breakdown: [],
            suggestedLibrary: null,
            isAuthoritative: false,
            requiresAI: true,
            hasConflict: false,
            meetsThreshold: false,
            threshold,
        };
    }

    const breakdown = [];

    const authoritativeSignals = [];
    const regularSignals = [];

    for (const signal of signals) {
        const weight = getWeight(signal.type);
        const normalizedScore = normalizeSignalScore(signal);
        const weightedScore = normalizeNumericPrecision((weight / 100) * normalizedScore);
        const isAuthoritative = weight >= 100 && Boolean(signal.library);

        breakdown.push({
            type: signal.type,
            rawScore: signal.rawScore,
            normalizedScore,
            weight: weight,
            isAuthoritative,
            library: signal.library?.name || null,
            weightedScore,
        });

        if (isAuthoritative) {
            authoritativeSignals.push({ signal, weight });
        } else {
            regularSignals.push({ signal, weight, normalizedScore, weightedScore });
        }
    }

    if (authoritativeSignals.length > 0) {
        const authoritativeLibraries = new Map();
        for (const { signal } of authoritativeSignals) {
            const libraryKey = getLibraryConflictKey(signal.library);
            if (!libraryKey) {
                continue;
            }

            if (!authoritativeLibraries.has(libraryKey)) {
                authoritativeLibraries.set(libraryKey, {
                    library: signal.library,
                    signalTypes: [signal.type],
                });
                continue;
            }

            authoritativeLibraries.get(libraryKey).signalTypes.push(signal.type);
        }

        if (authoritativeLibraries.size > 1) {
            const conflictLibraries = [...authoritativeLibraries.values()]
                .sort((left, right) => compareLibraries(left.library, right.library))
                .map((entry) => ({
                    library: entry.library,
                    signalTypes: [...new Set(entry.signalTypes)].sort(),
                }));

            logger.warn('Conflicting authoritative signals detected; downgrading to manual review', {
                libraries: conflictLibraries.map((entry) => ({
                    id: entry.library?.id ?? null,
                    name: entry.library?.name ?? null,
                    signalTypes: entry.signalTypes,
                })),
            });

            return {
                confidence: 0,
                rawConfidence: 0,
                displayConfidence: 0,
                breakdown,
                suggestedLibrary: conflictLibraries[0]?.library || null,
                suggestedLibraryScore: 0,
                alternativeLibrary: conflictLibraries[1]?.library || null,
                alternativeLibraryScore: 0,
                isAuthoritative: false,
                requiresAI: true,
                authoritativeConflict: true,
                authoritativeConflictLibraries: conflictLibraries,
                authoritativeSignals: authoritativeSignals.map(({ signal }) => ({
                    type: signal.type,
                    libraryId: signal.library?.id ?? null,
                    libraryName: signal.library?.name ?? null,
                })),
                hasConflict: true,
                meetsThreshold: false,
                threshold,
            };
        }

        const authoritative = authoritativeSignals[0];
        logger.info('Authoritative signal detected - auto-classifying', {
            type: authoritative.signal.type,
            library: authoritative.signal.library?.name,
        });

        return {
            confidence: 100,
            rawConfidence: 100,
            displayConfidence: 100,
            breakdown,
            suggestedLibrary: authoritative.signal.library,
            isAuthoritative: true,
            requiresAI: false,
            authoritativeSignal: authoritative.signal.type,
            authoritativeSignals: authoritativeSignals.map(({ signal }) => ({
                type: signal.type,
                libraryId: signal.library?.id ?? null,
                libraryName: signal.library?.name ?? null,
            })),
            authoritativeConflict: false,
            hasConflict: false,
            meetsThreshold: true,
            threshold,
        };
    }

    const libraryScores = {};

    for (const { signal, weightedScore } of regularSignals) {
        if (signal.library) {
            const libId = signal.library.id;
            if (!libraryScores[libId]) {
                libraryScores[libId] = {
                    library: signal.library,
                    totalScore: 0,
                    signalCount: 0,
                    signals: [],
                };
            }
            libraryScores[libId].totalScore += weightedScore;
            libraryScores[libId].signalCount += 1;
            libraryScores[libId].signals.push(signal);
        }
    }

    const sortedLibraries = Object.values(libraryScores)
        .sort((a, b) => b.totalScore - a.totalScore);

    const topLibrary = sortedLibraries[0] || null;
    const secondLibrary = sortedLibraries[1] || null;

    let hasConflict = false;
    if (topLibrary && secondLibrary) {
        const scoreDiff = topLibrary.totalScore - secondLibrary.totalScore;
        hasConflict = scoreDiff < (topLibrary.totalScore * 0.2);
    }

    const rawConfidence = topLibrary
        ? normalizeNumericPrecision(Math.min(100, topLibrary.totalScore))
        : 0;
    const confidence = Math.round(rawConfidence);

    const meetsThreshold = rawConfidence >= threshold;

    const result = {
        confidence,
        rawConfidence,
        displayConfidence: confidence,
        breakdown,
        suggestedLibrary: topLibrary?.library || null,
        suggestedLibraryScore: topLibrary?.totalScore || 0,
        alternativeLibrary: secondLibrary?.library || null,
        alternativeLibraryScore: secondLibrary?.totalScore || 0,
        isAuthoritative: false,
        requiresAI: true,
        authoritativeConflict: false,
        hasConflict,
        meetsThreshold,
        threshold,
    };

    logger.debug('Confidence calculated', {
        confidence: result.confidence,
        rawConfidence: result.rawConfidence,
        suggested: result.suggestedLibrary?.name,
        hasConflict: result.hasConflict,
        meetsThreshold: result.meetsThreshold,
        requiresAI: result.requiresAI,
    });

    return result;
}

export function toAIContext(calculationResult) {
    const lines = ['--- CONFIDENCE CALCULATION ---'];

    if (calculationResult.isAuthoritative) {
        lines.push(`✓ AUTHORITATIVE SIGNAL: ${calculationResult.authoritativeSignal}`);
        lines.push(`Library: "${calculationResult.suggestedLibrary?.name}"`);
        lines.push('AI verification: NOT REQUIRED');
        return lines.join('\n');
    }

    lines.push(`Calculated confidence: ${calculationResult.displayConfidence ?? calculationResult.confidence}%`);
    lines.push(`Threshold: ${calculationResult.threshold}%`);
    lines.push(`Meets threshold: ${calculationResult.meetsThreshold ? 'YES' : 'NO'}`);
    lines.push('AI verification: REQUIRED');

    if (calculationResult.authoritativeConflict) {
        lines.push('⚠️ AUTHORITATIVE CONFLICT: conflicting authoritative signals point to different libraries');
        for (const entry of calculationResult.authoritativeConflictLibraries || []) {
            lines.push(`  ${entry.signalTypes.join(', ')} → "${entry.library?.name || 'Unknown'}"`);
        }
    }

    if (calculationResult.suggestedLibrary) {
        lines.push(`Suggested library: "${calculationResult.suggestedLibrary.name}" (score: ${calculationResult.suggestedLibraryScore.toFixed(1)})`);
    }

    if (calculationResult.hasConflict && !calculationResult.authoritativeConflict) {
        lines.push(`⚠️ CONFLICT DETECTED: "${calculationResult.alternativeLibrary?.name}" is close (score: ${calculationResult.alternativeLibraryScore.toFixed(1)})`);
    }

    lines.push('');
    lines.push('Breakdown:');
    for (const item of calculationResult.breakdown) {
        const authMarker = item.isAuthoritative ? ' [AUTH]' : '';
        lines.push(`  • ${item.type}${authMarker}: weight ${item.weight} → ${item.library || 'N/A'}`);
    }

    return lines.join('\n');
}

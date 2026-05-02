/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');
const { SIGNAL_TYPES } = require('./signalCollector');
const { createLogger } = require('../utils/logger');

const logger = createLogger('ConfidenceCalculator');

const PROFILE_SCORE_NEUTRAL_BASELINE = 50;

function parseConfiguredNumber(value) {
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

    const parsedValue = Number(trimmedValue);
    return Number.isFinite(parsedValue) ? parsedValue : null;
}

function getLibraryConflictKey(library) {
    if (!library) {
        return null;
    }

    if (library.id !== undefined && library.id !== null) {
        return `id:${String(library.id)}`;
    }

    if (typeof library.name === 'string' && library.name.trim().length > 0) {
        return `name:${library.name.trim().toLowerCase()}`;
    }

    return null;
}

function compareLibraries(left, right) {
    const leftName = String(left?.name || '');
    const rightName = String(right?.name || '');
    if (leftName !== rightName) {
        return leftName.localeCompare(rightName);
    }

    return String(left?.id || '').localeCompare(String(right?.id || ''));
}

function normalizeNumericPrecision(value) {
    return Number(value.toFixed(6));
}

/**
 * Default weights for each signal type
 * Users can override these in the Confidence Settings
 *
 * 100% weight = AUTHORITATIVE - auto-classify without AI
 * < 100% weight = requires AI verification
 */
const DEFAULT_WEIGHTS = {
    [SIGNAL_TYPES.SOURCE_LIBRARY]: 100,      // Absolute trust - from Plex (already classified)
    [SIGNAL_TYPES.MANUAL_CORRECTION]: 100,   // Absolute trust - user corrected this TMDB ID
    [SIGNAL_TYPES.EXISTING_MEDIA]: 100,      // Already in a library
    [SIGNAL_TYPES.EXACT_MATCH]: 100,         // Previously confirmed for this TMDB ID
    [SIGNAL_TYPES.SEMANTIC_SIMILARITY]: 75,  // RAG-based similarity (dynamic: 50-90)
    [SIGNAL_TYPES.PROFILE_SCORE]: 60,        // Library profile match (v0.38.0+)
    [SIGNAL_TYPES.CUSTOM_RULE]: 35,          // Matches confidence_settings migration default
    [SIGNAL_TYPES.COLLECTION_MATCH]: 25,     // Franchise consistency
    [SIGNAL_TYPES.LEARNED_PATTERN]: 20,      // AI-learned patterns
    [SIGNAL_TYPES.CONTENT_ANALYSIS]: 15,     // Content type analysis
    [SIGNAL_TYPES.KEYWORD_MATCH]: 10,        // Keyword matching
    [SIGNAL_TYPES.GENRE_MATCH]: 10,          // Genre matching
};

/**
 * ConfidenceCalculator - Applies weighted formula to collected signals
 *
 * Logic:
 * 1. Check for authoritative signals (100% weight) - auto-classify without AI
 * 2. If no authoritative signals, sum remaining signals (capped at 100)
 * 3. All non-authoritative signals require AI verification
 * 4. Threshold determines if AI auto-classifies or asks user
 */
class ConfidenceCalculator {
    constructor() {
        this.weights = { ...DEFAULT_WEIGHTS };
        this.threshold = 80; // Default confidence threshold
    }

    normalizeSignalScore(signal) {
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

    /**
     * Load user-configured weights from database
     */
    async loadWeights() {
        try {
            const result = await db.query(
                `SELECT setting_key, setting_value 
                 FROM confidence_settings 
                 WHERE setting_key LIKE 'weight_%'`
            );

            for (const row of result.rows) {
                const signalType = row.setting_key.replace('weight_', '');
                const parsedWeight = parseConfiguredNumber(row.setting_value);
                if (parsedWeight !== null) {
                    this.weights[signalType] = parsedWeight;
                    continue;
                }

                if (Object.prototype.hasOwnProperty.call(DEFAULT_WEIGHTS, signalType)) {
                    this.weights[signalType] = DEFAULT_WEIGHTS[signalType];
                }
            }

            // Load threshold
            const thresholdResult = await db.query(
                `SELECT setting_value FROM confidence_settings WHERE setting_key = 'confidence_threshold'`
            );
            if (thresholdResult.rows.length > 0) {
                const parsedThreshold = parseConfiguredNumber(thresholdResult.rows[0].setting_value);
                if (parsedThreshold !== null) {
                    this.threshold = parsedThreshold;
                }
            }

            logger.debug('Loaded confidence weights', { weights: this.weights, threshold: this.threshold });
        } catch (error) {
            // Table might not exist yet - use defaults
            logger.debug('Using default weights', { error: error.message });
        }
    }

    /**
     * Get the weight for a signal type
     */
    getWeight(signalType) {
        return this.weights[signalType] || 0;
    }

    /**
     * Get the current confidence threshold
     */
    getThreshold() {
        return this.threshold;
    }

    /**
     * Calculate confidence score from collected signals
     *
     * Logic:
     * 1. Check for authoritative signals (100% weight) - these auto-classify without AI
     * 2. If no authoritative signals, sum remaining signals (capped at 100)
     * 3. All non-authoritative signals require AI verification
     *
     * @param {Array} signals - Array of signal objects from SignalCollector
     * @returns {object} { confidence, breakdown, suggestedLibrary, isAuthoritative, requiresAI }
     */
    calculate(signals) {
        if (!signals || signals.length === 0) {
            return {
                confidence: 0,
                breakdown: [],
                suggestedLibrary: null,
                isAuthoritative: false,
                requiresAI: true,
                hasConflict: false,
                meetsThreshold: false,
                threshold: this.threshold,
            };
        }

        const breakdown = [];

        // STEP 1: Check for authoritative signals (100% weight)
        // These are "already decided" scenarios - skip AI entirely
        const authoritativeSignals = [];
        const regularSignals = [];

        for (const signal of signals) {
            const weight = this.getWeight(signal.type);
            const normalizedScore = this.normalizeSignalScore(signal);
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

        // If we have authoritative signals, they must agree on the same library.
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
                    threshold: this.threshold,
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
                requiresAI: false, // No AI needed for authoritative signals
                authoritativeSignal: authoritative.signal.type,
                authoritativeSignals: authoritativeSignals.map(({ signal }) => ({
                    type: signal.type,
                    libraryId: signal.library?.id ?? null,
                    libraryName: signal.library?.name ?? null,
                })),
                authoritativeConflict: false,
                hasConflict: false,
                meetsThreshold: true,
                threshold: this.threshold,
            };
        }

        // STEP 2: No authoritative signals - sum regular signals by library
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

        // Find the library with highest score
        const sortedLibraries = Object.values(libraryScores)
            .sort((a, b) => b.totalScore - a.totalScore);

        const topLibrary = sortedLibraries[0] || null;
        const secondLibrary = sortedLibraries[1] || null;

        // Detect conflict: two libraries have close scores (within 20%)
        let hasConflict = false;
        if (topLibrary && secondLibrary) {
            const scoreDiff = topLibrary.totalScore - secondLibrary.totalScore;
            hasConflict = scoreDiff < (topLibrary.totalScore * 0.2);
        }

        const rawConfidence = topLibrary
            ? normalizeNumericPrecision(Math.min(100, topLibrary.totalScore))
            : 0;
        const confidence = Math.round(rawConfidence);

        const meetsThreshold = rawConfidence >= this.threshold;

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
            requiresAI: true, // All non-authoritative signals require AI verification
            authoritativeConflict: false,
            hasConflict,
            meetsThreshold,
            threshold: this.threshold,
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

    /**
     * Generate explanation for AI context
     */
    toAIContext(calculationResult) {
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

    /**
     * Save weights to database
     */
    async saveWeights(weights) {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            for (const [signalType, weight] of Object.entries(weights)) {
                await client.query(
                    `INSERT INTO confidence_settings (setting_key, setting_value)
                     VALUES ($1, $2)
                     ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2`,
                    [`weight_${signalType}`, weight.toString()]
                );
            }

            await client.query('COMMIT');
            this.weights = { ...DEFAULT_WEIGHTS, ...weights };
            logger.info('Saved confidence weights', { weights });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Save threshold to database
     */
    async saveThreshold(threshold) {
        await db.query(
            `INSERT INTO confidence_settings (setting_key, setting_value)
             VALUES ('confidence_threshold', $1)
             ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1`,
            [threshold.toString()]
        );
        this.threshold = threshold;
        logger.info('Saved confidence threshold', { threshold });
    }

    /**
     * Get all weights (for settings UI)
     */
    getWeights() {
        return { ...this.weights };
    }

    /**
     * Get default weights (for reset functionality)
     */
    getDefaultWeights() {
        return { ...DEFAULT_WEIGHTS };
    }
}

module.exports = new ConfidenceCalculator();

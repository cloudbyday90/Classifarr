/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');
const { SIGNAL_TYPES } = require('./signalCollector');
const { createLogger } = require('../utils/logger');

const logger = createLogger('ConfidenceCalculator');

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
    [SIGNAL_TYPES.EVENT_DETECTION]: 30,      // Holiday/sports detection
    [SIGNAL_TYPES.CUSTOM_RULE]: 35,          // User-defined rules
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
                this.weights[signalType] = parseInt(row.setting_value) || DEFAULT_WEIGHTS[signalType];
            }

            // Load threshold
            const thresholdResult = await db.query(
                `SELECT setting_value FROM confidence_settings WHERE setting_key = 'confidence_threshold'`
            );
            if (thresholdResult.rows.length > 0) {
                this.threshold = parseInt(thresholdResult.rows[0].setting_value) || 80;
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
            const isAuthoritative = weight >= 100 && signal.library;

            breakdown.push({
                type: signal.type,
                rawScore: signal.rawScore,
                weight: weight,
                isAuthoritative,
                library: signal.library?.name || null,
            });

            if (isAuthoritative) {
                authoritativeSignals.push({ signal, weight });
            } else {
                regularSignals.push({ signal, weight });
            }
        }

        // If we have authoritative signals, use the first one (they shouldn't conflict)
        if (authoritativeSignals.length > 0) {
            const authoritative = authoritativeSignals[0];
            logger.info('Authoritative signal detected - auto-classifying', {
                type: authoritative.signal.type,
                library: authoritative.signal.library?.name,
            });

            return {
                confidence: 100,
                breakdown,
                suggestedLibrary: authoritative.signal.library,
                isAuthoritative: true,
                requiresAI: false, // No AI needed for authoritative signals
                authoritativeSignal: authoritative.signal.type,
                hasConflict: false,
                meetsThreshold: true,
                threshold: this.threshold,
            };
        }

        // STEP 2: No authoritative signals - sum regular signals by library
        const libraryScores = {};

        for (const { signal, weight } of regularSignals) {
            // Weight contribution: (weight / 100) * rawScore
            // This means a 35-weight signal with 100% match contributes 35 points
            const weightedScore = (weight / 100) * signal.rawScore;

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

        // Final confidence is the top library's total score, capped at 100
        const confidence = topLibrary
            ? Math.min(100, Math.round(topLibrary.totalScore))
            : 0;

        const meetsThreshold = confidence >= this.threshold;

        const result = {
            confidence,
            breakdown,
            suggestedLibrary: topLibrary?.library || null,
            suggestedLibraryScore: topLibrary?.totalScore || 0,
            alternativeLibrary: secondLibrary?.library || null,
            alternativeLibraryScore: secondLibrary?.totalScore || 0,
            isAuthoritative: false,
            requiresAI: true, // All non-authoritative signals require AI verification
            hasConflict,
            meetsThreshold,
            threshold: this.threshold,
        };

        logger.debug('Confidence calculated', {
            confidence: result.confidence,
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
            lines.push(`AI verification: NOT REQUIRED`);
            return lines.join('\n');
        }

        lines.push(`Calculated confidence: ${calculationResult.confidence}%`);
        lines.push(`Threshold: ${calculationResult.threshold}%`);
        lines.push(`Meets threshold: ${calculationResult.meetsThreshold ? 'YES' : 'NO'}`);
        lines.push(`AI verification: REQUIRED`);

        if (calculationResult.suggestedLibrary) {
            lines.push(`Suggested library: "${calculationResult.suggestedLibrary.name}" (score: ${calculationResult.suggestedLibraryScore.toFixed(1)})`);
        }

        if (calculationResult.hasConflict) {
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

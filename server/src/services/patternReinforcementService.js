/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');
const embeddingRouter = require('./embeddingRouter');
const { createLogger } = require('../utils/logger');

const logger = createLogger('PatternReinforcement');

// Configuration constants
const CONFIDENCE_BOOST = 5;  // Boost by 5% on correct prediction
const CONFIDENCE_DECAY = 5;  // Decay by 5% on incorrect prediction
const MIN_CONFIDENCE = 30;   // Auto-deprecate below 30%
const MAX_CONFIDENCE = 95;   // Cap confidence at 95%

/**
 * Pattern Reinforcement Service
 * Implements reinforcement learning for discovered patterns
 */
class PatternReinforcementService {
    /**
     * Check if pattern-based classification is enabled
     */
    async isEnabled() {
        try {
            const config = await embeddingRouter.getConfig();
            return config?.pattern_mining_enabled === true;
        } catch (error) {
            logger.error('Failed to check pattern enabled status', { error: error.message });
            return false;
        }
    }

    /**
     * Reinforce a pattern when user accepts a classification
     * @param {number} classificationId - Classification history ID
     * @param {Array} patternSignals - Pattern signals that were used
     * @param {number} selectedLibraryId - Library that was selected
     */
    async reinforceOnAccept(classificationId, patternSignals, selectedLibraryId) {
        try {
            const enabled = await this.isEnabled();
            if (!enabled) {
                return;
            }

            if (!patternSignals || patternSignals.length === 0) {
                return;
            }

            logger.debug('Reinforcing patterns on accept', {
                classificationId,
                patternsCount: patternSignals.length,
                selectedLibraryId
            });

            for (const signal of patternSignals) {
                // Check if pattern suggested the correct library
                const isCorrect = signal.library?.id === selectedLibraryId;

                // Log the pattern match
                await this.logPatternMatch(
                    signal.pattern_id,
                    classificationId,
                    signal.pattern_value,
                    signal.confidence,
                    true, // suggestion was used
                    isCorrect
                );

                // Adjust confidence
                if (isCorrect) {
                    await this.boostConfidence(signal.pattern_id);
                } else {
                    await this.decayConfidence(signal.pattern_id);
                }
            }
        } catch (error) {
            logger.error('Error reinforcing patterns on accept', { error: error.message });
        }
    }

    /**
     * Reinforce a pattern when user corrects a classification
     * @param {number} classificationId - Classification history ID
     * @param {Array} patternSignals - Pattern signals that were used
     * @param {number} correctedLibraryId - Library that was corrected to
     */
    async reinforceOnCorrection(classificationId, patternSignals, correctedLibraryId) {
        try {
            const enabled = await this.isEnabled();
            if (!enabled) {
                return;
            }

            if (!patternSignals || patternSignals.length === 0) {
                return;
            }

            logger.debug('Reinforcing patterns on correction', {
                classificationId,
                patternsCount: patternSignals.length,
                correctedLibraryId
            });

            for (const signal of patternSignals) {
                // Pattern suggested wrong library if we're correcting
                const isCorrect = signal.library?.id === correctedLibraryId;

                // Log the pattern match
                await this.logPatternMatch(
                    signal.pattern_id,
                    classificationId,
                    signal.pattern_value,
                    signal.confidence,
                    false, // suggestion was NOT used (it was corrected)
                    isCorrect
                );

                // Adjust confidence - decay since prediction was wrong
                if (!isCorrect) {
                    await this.decayConfidence(signal.pattern_id);
                } else {
                    // Pattern was actually correct, user just confirmed
                    await this.boostConfidence(signal.pattern_id);
                }
            }
        } catch (error) {
            logger.error('Error reinforcing patterns on correction', { error: error.message });
        }
    }

    /**
     * Log a pattern match for analytics
     */
    async logPatternMatch(patternId, classificationId, matchedValue, confidenceContribution, suggestionUsed, isCorrect) {
        try {
            await db.query(`
                INSERT INTO pattern_match_log (
                    pattern_id,
                    classification_id,
                    matched_value,
                    confidence_contribution,
                    suggestion_used,
                    was_correct
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                patternId,
                classificationId,
                matchedValue,
                confidenceContribution,
                suggestionUsed,
                isCorrect
            ]);

            // Update last_seen_at on the pattern
            await db.query(`
                UPDATE discovered_patterns
                SET last_seen_at = NOW()
                WHERE id = $1
            `, [patternId]);

        } catch (error) {
            // Check if was_correct column doesn't exist yet (backward compatibility)
            if (error.message.includes('column "was_correct" of relation "pattern_match_log"')) {
                // Try without was_correct column
                await db.query(`
                    INSERT INTO pattern_match_log (
                        pattern_id,
                        classification_id,
                        matched_value,
                        confidence_contribution,
                        suggestion_used
                    ) VALUES ($1, $2, $3, $4, $5)
                `, [
                    patternId,
                    classificationId,
                    matchedValue,
                    confidenceContribution,
                    suggestionUsed
                ]);
            } else {
                logger.error('Error logging pattern match', { error: error.message, patternId });
            }
        }
    }

    /**
     * Boost pattern confidence on correct prediction
     */
    async boostConfidence(patternId) {
        try {
            await db.query(`
                UPDATE discovered_patterns
                SET 
                    confidence = LEAST($1, confidence + $2),
                    updated_at = NOW()
                WHERE id = $3
            `, [MAX_CONFIDENCE, CONFIDENCE_BOOST, patternId]);

            logger.debug('Boosted pattern confidence', { patternId, boost: CONFIDENCE_BOOST });
        } catch (error) {
            logger.error('Error boosting confidence', { error: error.message, patternId });
        }
    }

    /**
     * Decay pattern confidence on incorrect prediction
     */
    async decayConfidence(patternId) {
        try {
            const result = await db.query(`
                UPDATE discovered_patterns
                SET 
                    confidence = GREATEST(0, confidence - $1),
                    updated_at = NOW()
                WHERE id = $2
                RETURNING confidence, pattern_type, pattern_value
            `, [CONFIDENCE_DECAY, patternId]);

            if (result.rows.length > 0) {
                const pattern = result.rows[0];
                logger.debug('Decayed pattern confidence', { 
                    patternId, 
                    decay: CONFIDENCE_DECAY,
                    newConfidence: pattern.confidence 
                });

                // Auto-deprecate if below minimum
                if (parseFloat(pattern.confidence) < MIN_CONFIDENCE) {
                    await this.deprecatePattern(patternId, pattern);
                }
            }
        } catch (error) {
            logger.error('Error decaying confidence', { error: error.message, patternId });
        }
    }

    /**
     * Deprecate a pattern that has fallen below minimum confidence
     */
    async deprecatePattern(patternId, patternInfo) {
        try {
            await db.query(`
                UPDATE discovered_patterns
                SET 
                    status = 'decayed',
                    updated_at = NOW()
                WHERE id = $1
            `, [patternId]);

            logger.info('Auto-deprecated pattern', {
                patternId,
                type: patternInfo.pattern_type,
                value: patternInfo.pattern_value,
                finalConfidence: patternInfo.confidence
            });
        } catch (error) {
            logger.error('Error deprecating pattern', { error: error.message, patternId });
        }
    }

    /**
     * Resolve conflicting patterns (same key -> different libraries)
     * Keeps highest confidence pattern, deprecates others
     */
    async resolveConflicts() {
        try {
            const enabled = await this.isEnabled();
            if (!enabled) {
                return { resolved: 0 };
            }

            logger.info('Resolving pattern conflicts');

            // Find conflicting patterns
            const conflicts = await db.query(`
                SELECT 
                    pattern_type,
                    pattern_value,
                    COUNT(*) as conflict_count,
                    ARRAY_AGG(id ORDER BY confidence DESC) as pattern_ids,
                    ARRAY_AGG(confidence ORDER BY confidence DESC) as confidences,
                    ARRAY_AGG(library_name ORDER BY confidence DESC) as library_names
                FROM discovered_patterns
                WHERE status IN ('discovered', 'approved')
                GROUP BY pattern_type, pattern_value
                HAVING COUNT(*) > 1
            `);

            let resolvedCount = 0;

            for (const conflict of conflicts.rows) {
                // Keep the highest confidence pattern (first in sorted array)
                const keepPatternId = conflict.pattern_ids[0];
                const deprecateIds = conflict.pattern_ids.slice(1);

                // Deprecate lower confidence patterns
                if (deprecateIds.length > 0) {
                    await db.query(`
                        UPDATE discovered_patterns
                        SET 
                            status = 'decayed',
                            updated_at = NOW()
                        WHERE id = ANY($1)
                    `, [deprecateIds]);

                    resolvedCount += deprecateIds.length;

                    logger.info('Resolved pattern conflict', {
                        type: conflict.pattern_type,
                        value: conflict.pattern_value,
                        kept: { id: keepPatternId, confidence: conflict.confidences[0], library: conflict.library_names[0] },
                        deprecated: deprecateIds.length
                    });
                }
            }

            logger.info('Conflict resolution complete', { resolved: resolvedCount });

            return { resolved: resolvedCount };
        } catch (error) {
            logger.error('Error resolving conflicts', { error: error.message });
            throw error;
        }
    }

    /**
     * Get pattern accuracy statistics
     */
    async getPatternAccuracy(patternId) {
        try {
            const result = await db.query(`
                SELECT 
                    COUNT(*) as total_uses,
                    COUNT(*) FILTER (WHERE suggestion_used = true) as times_used,
                    COUNT(*) FILTER (WHERE was_correct = true) as correct_predictions,
                    COUNT(*) FILTER (WHERE was_correct = false) as incorrect_predictions,
                    CASE 
                        WHEN COUNT(*) > 0 THEN 
                            ROUND(COUNT(*) FILTER (WHERE was_correct = true)::NUMERIC / COUNT(*)::NUMERIC * 100, 2)
                        ELSE 0 
                    END as accuracy_percentage
                FROM pattern_match_log
                WHERE pattern_id = $1
            `, [patternId]);

            if (result.rows.length > 0) {
                return result.rows[0];
            }

            return {
                total_uses: 0,
                times_used: 0,
                correct_predictions: 0,
                incorrect_predictions: 0,
                accuracy_percentage: 0
            };
        } catch (error) {
            // Handle case where was_correct column doesn't exist
            logger.warn('Could not get full accuracy stats', { error: error.message });
            return {
                total_uses: 0,
                times_used: 0,
                correct_predictions: 0,
                incorrect_predictions: 0,
                accuracy_percentage: 0
            };
        }
    }
}

module.exports = new PatternReinforcementService();

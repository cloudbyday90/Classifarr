/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import * as db from '../config/database.mjs';
import { embeddingRouter } from './embeddingRouter.mjs';
import { createLogger } from '../utils/logger.mjs';
import { withServiceCatch } from '../utils/serviceCatch.mjs';

const logger = createLogger('PatternReinforcement');

const CONFIDENCE_BOOST = 5;
const CONFIDENCE_DECAY = 5;
const MIN_CONFIDENCE = 30;
const MAX_CONFIDENCE = 95;

class PatternReinforcementService {
    async isEnabled() {
        try {
            const config = await embeddingRouter.getConfig();
            return config?.pattern_mining_enabled === true;
        } catch (error) {
            logger.error('Failed to check pattern enabled status', { error: error.message });
            return false;
        }
    }

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
                const isCorrect = signal.library?.id === selectedLibraryId;

                await this.logPatternMatch(
                    signal.pattern_id,
                    classificationId,
                    signal.pattern_value,
                    signal.confidence,
                    true,
                    isCorrect
                );

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
                const isCorrect = signal.library?.id === correctedLibraryId;

                await this.logPatternMatch(
                    signal.pattern_id,
                    classificationId,
                    signal.pattern_value,
                    signal.confidence,
                    false,
                    isCorrect
                );

                if (!isCorrect) {
                    await this.decayConfidence(signal.pattern_id);
                } else {
                    await this.boostConfidence(signal.pattern_id);
                }
            }
        } catch (error) {
            logger.error('Error reinforcing patterns on correction', { error: error.message });
        }
    }

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

            await db.query(`
                UPDATE discovered_patterns
                SET last_seen_at = NOW()
                WHERE id = $1
            `, [patternId]);
        } catch (error) {
            if (error.message.includes('column "was_correct" of relation "pattern_match_log"')) {
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

                if (parseFloat(pattern.confidence) < MIN_CONFIDENCE) {
                    await this.deprecatePattern(patternId, pattern);
                }
            }
        } catch (error) {
            logger.error('Error decaying confidence', { error: error.message, patternId });
        }
    }

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

    async resolveConflicts() {
        return withServiceCatch(logger, 'Error resolving conflicts', async () => {
            const enabled = await this.isEnabled();
            if (!enabled) {
                return { resolved: 0 };
            }

            logger.info('Resolving pattern conflicts');

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
                const keepPatternId = conflict.pattern_ids[0];
                const deprecateIds = conflict.pattern_ids.slice(1);

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
        });
    }

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

export const patternReinforcementService = new PatternReinforcementService();

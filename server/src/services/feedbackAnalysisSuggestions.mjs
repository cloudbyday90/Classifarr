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
import { TUNING_CONSTANTS } from './feedbackAnalysisUtils.mjs';

const logger = createLogger('FeedbackAnalysis');

export async function generateSuggestions(_policyId, analysis) {
    try {
        const suggestions = [];

        if (analysis.failurePatterns) {
            for (const pattern of analysis.failurePatterns.missedPositives || []) {
                if (pattern.count >= 3) {
                    suggestions.push({
                        type: 'create_pattern',
                        config: {
                            pattern_type: pattern.type,
                            pattern_value: pattern.value,
                            confidence: Math.min(pattern.count * 20, 90)
                        },
                        supporting_feedback: pattern.feedbackIds || [],
                        confidence: Math.min(pattern.count * 15, 85),
                        impact_estimate: `Found in ${pattern.count} corrections toward this policy`
                    });
                }
            }

            for (const issue of analysis.failurePatterns.thresholdIssues || []) {
                if (issue.recommendation === 'increase_auto_classify_threshold') {
                    suggestions.push({
                        type: 'adjust_threshold',
                        config: {
                            threshold_type: 'auto_classify',
                            current: null,
                            recommended: null,
                            reason: `High false positive rate (${(issue.correctionRate * 100).toFixed(1)}%)`
                        },
                        supporting_feedback: [],
                        confidence: 70,
                        impact_estimate: `May reduce false positives by ${(issue.correctionRate * 50).toFixed(0)}%`
                    });
                } else if (issue.recommendation === 'decrease_auto_classify_threshold') {
                    suggestions.push({
                        type: 'adjust_threshold',
                        config: {
                            threshold_type: 'auto_classify',
                            current: null,
                            recommended: null,
                            reason: `Low auto-classification rate (${(issue.autoRate * 100).toFixed(1)}%)`
                        },
                        supporting_feedback: [],
                        confidence: 65,
                        impact_estimate: `May increase auto-classification by ${((1 - issue.autoRate) * 30).toFixed(0)}%`
                    });
                }
            }
        }

        if (analysis.signalEffectiveness) {
            for (const [signal, stats] of Object.entries(analysis.signalEffectiveness)) {
                if (stats.accuracy < 0.5 && (stats.correct + stats.incorrect) >= 5) {
                    suggestions.push({
                        type: 'adjust_weight',
                        config: {
                            signal,
                            current: null,
                            recommended: null,
                            reason: `Low accuracy (${(stats.accuracy * 100).toFixed(1)}%)`
                        },
                        supporting_feedback: [],
                        confidence: 60,
                        impact_estimate: `Signal has ${(stats.accuracy * 100).toFixed(1)}% accuracy`
                    });
                } else if (stats.accuracy > 0.85 && (stats.correct + stats.incorrect) >= 10) {
                    suggestions.push({
                        type: 'adjust_weight',
                        config: {
                            signal,
                            current: null,
                            recommended: null,
                            reason: `High accuracy (${(stats.accuracy * 100).toFixed(1)}%)`
                        },
                        supporting_feedback: [],
                        confidence: 75,
                        impact_estimate: `Signal has ${(stats.accuracy * 100).toFixed(1)}% accuracy`
                    });
                }
            }
        }

        if (analysis.newPatterns && analysis.newPatterns.length > 0) {
            for (const pattern of analysis.newPatterns) {
                suggestions.push({
                    type: 'create_pattern',
                    config: {
                        pattern_type: pattern.type,
                        pattern_value: pattern.value,
                        confidence: Math.min(pattern.count * 20, 90)
                    },
                    supporting_feedback: pattern.feedbackIds || [],
                    confidence: Math.min(pattern.count * 15, 85),
                    impact_estimate: `Found in ${pattern.count} user corrections`
                });
            }
        }

        return suggestions;

    } catch (error) {
        logger.error('Failed to generate suggestions', { error: error.message });
        return [];
    }
}

export async function storeSuggestions(policyId, suggestions) {
    try {
        const policyResult = await db.query(`
            SELECT 
                auto_classify_threshold,
                prompt_threshold,
                preset_weight,
                pattern_weight,
                rag_weight,
                history_weight
            FROM library_policies
            WHERE id = $1
        `, [policyId]);

        if (policyResult.rows.length === 0) {
            throw new Error('Policy not found');
        }

        const policy = policyResult.rows[0];
        const storedSuggestions = [];

        for (const suggestion of suggestions) {
            if (suggestion.type === 'adjust_threshold') {
                const thresholdType = suggestion.config.threshold_type;
                if (thresholdType === 'auto_classify') {
                    suggestion.config.current = policy.auto_classify_threshold;
                    if (suggestion.config.reason.includes('High false positive')) {
                        suggestion.config.recommended = Math.min(
                            policy.auto_classify_threshold + TUNING_CONSTANTS.THRESHOLD_ADJUSTMENT,
                            TUNING_CONSTANTS.MAX_AUTO_CLASSIFY_THRESHOLD
                        );
                    } else {
                        suggestion.config.recommended = Math.max(
                            policy.auto_classify_threshold - TUNING_CONSTANTS.THRESHOLD_ADJUSTMENT,
                            TUNING_CONSTANTS.MIN_AUTO_CLASSIFY_THRESHOLD
                        );
                    }
                } else if (thresholdType === 'prompt') {
                    suggestion.config.current = policy.prompt_threshold;
                    suggestion.config.recommended = Math.max(
                        policy.prompt_threshold - TUNING_CONSTANTS.THRESHOLD_ADJUSTMENT,
                        TUNING_CONSTANTS.MIN_PROMPT_THRESHOLD
                    );
                }
            } else if (suggestion.type === 'adjust_weight') {
                const signal = suggestion.config.signal;
                const weightMap = {
                    preset: policy.preset_weight || 0.40,
                    pattern: policy.pattern_weight || 0.30,
                    rag: policy.rag_weight || 0.20,
                    history: policy.history_weight || 0.10
                };
                suggestion.config.current = weightMap[signal];

                if (suggestion.config.reason.includes('Low accuracy')) {
                    suggestion.config.recommended = Math.max(
                        suggestion.config.current - TUNING_CONSTANTS.WEIGHT_ADJUSTMENT,
                        TUNING_CONSTANTS.MIN_WEIGHT
                    );
                } else {
                    suggestion.config.recommended = Math.min(
                        suggestion.config.current + TUNING_CONSTANTS.WEIGHT_ADJUSTMENT,
                        TUNING_CONSTANTS.MAX_WEIGHT
                    );
                }
            }

            const existingResult = await db.query(`
                SELECT id FROM policy_tuning_suggestions
                WHERE policy_id = $1
                AND suggestion_type = $2
                AND suggestion_config::text = $3::text
                AND status = 'pending'
            `, [policyId, suggestion.type, JSON.stringify(suggestion.config)]);

            if (existingResult.rows.length > 0) {
                logger.debug('Similar suggestion already exists', {
                    suggestionId: existingResult.rows[0].id
                });
                continue;
            }

            const result = await db.query(`
                INSERT INTO policy_tuning_suggestions (
                    policy_id,
                    suggestion_type,
                    suggestion_config,
                    supporting_feedback_ids,
                    confidence,
                    impact_estimate,
                    status
                )
                VALUES ($1, $2, $3, $4, $5, $6, 'pending')
                RETURNING id, suggestion_type, suggestion_config, confidence, impact_estimate, status, created_at
            `, [
                policyId,
                suggestion.type,
                JSON.stringify(suggestion.config),
                suggestion.supporting_feedback || [],
                suggestion.confidence,
                suggestion.impact_estimate
            ]);

            storedSuggestions.push(result.rows[0]);
        }

        logger.info('Suggestions stored', {
            policyId,
            count: storedSuggestions.length
        });

        return storedSuggestions;

    } catch (error) {
        logger.error('Failed to store suggestions', { error: error.message });
        throw error;
    }
}

export async function getPendingSuggestions(policyId) {
    try {
        const result = await db.query(`
            SELECT 
                pts.*,
                lp.name as policy_name,
                lp.library_id
            FROM policy_tuning_suggestions pts
            JOIN library_policies lp ON pts.policy_id = lp.id
            WHERE pts.policy_id = $1
            AND pts.status = 'pending'
            ORDER BY pts.confidence DESC, pts.created_at DESC
        `, [policyId]);

        return result.rows;

    } catch (error) {
        logger.error('Failed to get pending suggestions', { error: error.message });
        throw error;
    }
}

export async function applySuggestion(suggestionId, userId) {
    try {
      const result = await db.withTransaction(async (client) => {

        const suggestionResult = await client.query(`
            SELECT * FROM policy_tuning_suggestions
            WHERE id = $1
        `, [suggestionId]);

        if (suggestionResult.rows.length === 0) {
            throw new Error('Suggestion not found');
        }

        const suggestion = suggestionResult.rows[0];
        const config = suggestion.suggestion_config;

        const beforeResult = await client.query(`
            SELECT 
                auto_classify_threshold,
                prompt_threshold,
                preset_weight,
                pattern_weight,
                rag_weight,
                history_weight
            FROM library_policies WHERE id = $1
        `, [suggestion.policy_id]);

        const before_metrics = beforeResult.rows[0];

        let applied = false;
        const change_type = suggestion.suggestion_type;

        if (suggestion.suggestion_type === 'adjust_threshold') {
            if (config.threshold_type === 'auto_classify') {
                await client.query(`
                    UPDATE library_policies
                    SET auto_classify_threshold = $1, updated_at = NOW()
                    WHERE id = $2
                `, [config.recommended, suggestion.policy_id]);
                applied = true;
            } else if (config.threshold_type === 'prompt') {
                await client.query(`
                    UPDATE library_policies
                    SET prompt_threshold = $1, updated_at = NOW()
                    WHERE id = $2
                `, [config.recommended, suggestion.policy_id]);
                applied = true;
            }
        } else if (suggestion.suggestion_type === 'adjust_weight') {
            const validSignals = ['preset', 'pattern', 'rag', 'history'];
            if (!validSignals.includes(config.signal)) {
                throw new Error(`Invalid signal type: ${config.signal}`);
            }

            const weightField = `${config.signal}_weight`;
            await client.query(`
                UPDATE library_policies
                SET ${weightField} = $1, updated_at = NOW()
                WHERE id = $2
            `, [config.recommended, suggestion.policy_id]);
            applied = true;
        } else if (suggestion.suggestion_type === 'create_pattern') {
            const libraryResult = await client.query(`
                SELECT library_id FROM library_policies WHERE id = $1
            `, [suggestion.policy_id]);

            if (libraryResult.rows.length > 0) {
                const library_id = libraryResult.rows[0].library_id;

                await client.query(`
                    INSERT INTO discovered_patterns (
                        pattern_type,
                        pattern_value,
                        library_id,
                        confidence,
                        status,
                        source
                    )
                    VALUES ($1, $2, $3, $4, 'approved', 'feedback_analysis')
                    ON CONFLICT (pattern_type, pattern_value, library_id) DO UPDATE
                    SET confidence = GREATEST(discovered_patterns.confidence, EXCLUDED.confidence),
                        status = 'approved',
                        updated_at = NOW()
                `, [
                    config.pattern_type,
                    config.pattern_value,
                    library_id,
                    config.confidence
                ]);
                applied = true;
            }
        }

        if (!applied) {
            throw new Error(`Unable to apply suggestion type: ${suggestion.suggestion_type}`);
        }

        await client.query(`
            UPDATE policy_tuning_suggestions
            SET status = 'applied',
                reviewed_at = NOW(),
                reviewed_by = $1
            WHERE id = $2
        `, [userId, suggestionId]);

        const afterResult = await client.query(`
            SELECT 
                auto_classify_threshold,
                prompt_threshold,
                preset_weight,
                pattern_weight,
                rag_weight,
                history_weight
            FROM library_policies WHERE id = $1
        `, [suggestion.policy_id]);

        const after_metrics = afterResult.rows[0];

        await client.query(`
            INSERT INTO policy_change_log (
                policy_id,
                change_type,
                change_config,
                before_metrics,
                after_metrics,
                applied_by,
                applied_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
            suggestion.policy_id,
            change_type,
            JSON.stringify(config),
            JSON.stringify(before_metrics),
            JSON.stringify(after_metrics),
            userId
        ]);

        return {
            success: true,
            suggestionId,
            policyId: suggestion.policy_id,
            type: suggestion.suggestion_type
        };
        });

        logger.info('Suggestion applied', {
            suggestionId,
            policyId: result.policyId,
            type: result.type,
            userId
        });

        return result;
    } catch (error) {
        logger.error('Failed to apply suggestion', { error: error.message, suggestionId });
        throw error;
    }
}

export async function rejectSuggestion(suggestionId, userId, reason) {
    try {
        await db.query(`
            UPDATE policy_tuning_suggestions
            SET status = 'rejected',
                reviewed_at = NOW(),
                reviewed_by = $1,
                rejection_reason = $2
            WHERE id = $3
        `, [userId, reason, suggestionId]);

        logger.info('Suggestion rejected', { suggestionId, userId, reason });

        return {
            success: true,
            suggestionId,
            status: 'rejected'
        };

    } catch (error) {
        logger.error('Failed to reject suggestion', { error: error.message });
        throw error;
    }
}

export async function getImpactMetrics(suggestionId) {
    try {
        const result = await db.query(`
            SELECT 
                pts.before_accuracy,
                pls.accuracy_rate as after_accuracy,
                (pls.accuracy_rate - pts.before_accuracy) as improvement,
                pts.applied_at
            FROM policy_tuning_suggestions pts
            LEFT JOIN policy_learning_stats pls ON pts.policy_id = pls.policy_id
            WHERE pts.id = $1 AND pts.status = 'applied'
        `, [suggestionId]);

        return result.rows[0] || null;
    } catch (error) {
        logger.error('Failed to get impact metrics', { error: error.message, suggestionId });
        throw error;
    }
}

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { TUNING_CONSTANTS } from './feedbackAnalysisUtils.mjs';

const logger = createLogger('FeedbackAnalysis');

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

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { resolveSuggestionConfig } from './feedbackAnalysisSuggestionConfig.mjs';
import { NotFoundError } from '../utils/appError.mjs';
import { withServiceCatch } from '../utils/serviceCatch.mjs';

const logger = createLogger('FeedbackAnalysis');

export async function storeSuggestions(policyId, suggestions) {
    return withServiceCatch(logger, 'Failed to store suggestions', () => db.withTransaction(async client => {
        // A fresh statement snapshot after the policy lock must see the previous writer's inserts.
        await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        const policyResult = await client.query(`
            SELECT 
                auto_classify_threshold,
                prompt_threshold,
                preset_weight,
                pattern_weight,
                rag_weight,
                history_weight
            FROM library_policies
            WHERE id = $1
            FOR NO KEY UPDATE
        `, [policyId]);

        if (policyResult.rows.length === 0) {
            throw new NotFoundError('Policy not found');
        }

        const policy = policyResult.rows[0];
        const storedSuggestions = [];

        for (const suggestion of suggestions) {
            const configJson = JSON.stringify(resolveSuggestionConfig(policy, suggestion));

            const existingResult = await client.query(`
                SELECT id FROM policy_tuning_suggestions
                WHERE policy_id = $1
                AND suggestion_type = $2
                AND suggestion_config = $3::jsonb
                AND status = 'pending'
                LIMIT 1
            `, [policyId, suggestion.type, configJson]);

            if (existingResult.rows.length > 0) {
                logger.debug('Similar suggestion already exists', {
                    suggestionId: existingResult.rows[0].id
                });
                continue;
            }

            const result = await client.query(`
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
                configJson,
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
    }));
}

export async function getPendingSuggestions(policyId) {
    return withServiceCatch(logger, 'Failed to get pending suggestions', async () => {
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
    });
}

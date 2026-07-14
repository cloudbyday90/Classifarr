import * as db from '../config/database.mjs';
import { ValidationError, NotFoundError } from '../utils/appError.mjs';
import { createLogger } from '../utils/logger.mjs';
import { withServiceCatch } from '../utils/serviceCatch.mjs';
import {
    POLICY_LEGACY_WRITE_OPERATION_IDS,
} from './policyLegacyWriteBoundary.mjs';
import {
    assertLegacyPolicyWriteAllowed,
    lockPolicyAuthorityForWrite,
} from './policyLegacyWriteGuard.mjs';

const logger = createLogger('FeedbackAnalysis');

export async function applySuggestion(suggestionId, userId) {
    return withServiceCatch(logger, 'Failed to apply suggestion', { suggestionId }, async () => {
      const result = await db.withTransaction(async (client) => {

        const suggestionResult = await client.query(`
            SELECT * FROM policy_tuning_suggestions
            WHERE id = $1
        `, [suggestionId]);

        if (suggestionResult.rows.length === 0) {
            throw new NotFoundError('Suggestion not found');
        }

        const suggestion = suggestionResult.rows[0];
        const config = suggestion.suggestion_config;

        const policy = await lockPolicyAuthorityForWrite({
            client,
            policyId: suggestion.policy_id,
        });
        assertLegacyPolicyWriteAllowed({
            policy,
            payload: {
                suggestion_type: suggestion.suggestion_type,
                suggestion_config: config,
            },
            operationId: POLICY_LEGACY_WRITE_OPERATION_IDS.APPLY_LEGACY_TUNING_SUGGESTION,
        });

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
                throw new ValidationError(`Invalid signal type: ${config.signal}`);
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
    });
}

export async function rejectSuggestion(suggestionId, userId, reason) {
    return withServiceCatch(logger, 'Failed to reject suggestion', async () => {
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
    });
}

export async function getImpactMetrics(suggestionId) {
    return withServiceCatch(logger, 'Failed to get impact metrics', { suggestionId }, async () => {
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
    });
}

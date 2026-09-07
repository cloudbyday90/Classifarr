import { upsertApprovedPattern } from './approvedPatternWriter.mjs';
import * as db from '../config/database.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { createLogger } from '../utils/logger.mjs';
import { withServiceCatch } from '../utils/serviceCatch.mjs';
import {
    POLICY_LEGACY_WRITE_OPERATION_IDS,
} from './policyLegacyWriteBoundary.mjs';
import {
    assertLegacyPolicyWriteAllowed,
} from './policyLegacyWriteGuard.mjs';
import { lockPendingSuggestion, completeSuggestionReview } from './feedbackAnalysisSuggestionLifecycle.mjs';
import { assertSuggestionEvidenceCurrent } from './feedbackAnalysisCohort.mjs';

const logger = createLogger('FeedbackAnalysis');

export async function applySuggestion(suggestionId, userId) {
    return withServiceCatch(logger, 'Failed to apply suggestion', { suggestionId }, async () => {
      const result = await db.withTransaction(async (client) => {

        const { suggestion, policy } = await lockPendingSuggestion(client, suggestionId);
        const config = suggestion.suggestion_config;

        assertLegacyPolicyWriteAllowed({
            policy,
            payload: {
                suggestion_type: suggestion.suggestion_type,
                suggestion_config: config,
            },
            operationId: POLICY_LEGACY_WRITE_OPERATION_IDS.APPLY_LEGACY_TUNING_SUGGESTION,
        });

        await assertSuggestionEvidenceCurrent(client, suggestion, policy);

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
        const stats = await client.query('SELECT accuracy_rate FROM policy_learning_stats WHERE policy_id = $1', [suggestion.policy_id]);
        const beforeAccuracy = stats.rows.length > 0 ? stats.rows[0].accuracy_rate : suggestion.before_accuracy;

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
                SELECT lp.library_id, l.name AS library_name
                FROM library_policies lp JOIN libraries l ON l.id = lp.library_id
                WHERE lp.id = $1
            `, [suggestion.policy_id]);

            if (libraryResult.rows.length > 0) {
                const library_id = libraryResult.rows[0].library_id;

                await upsertApprovedPattern(client, {
                    type: config.pattern_type,
                    value: config.pattern_value,
                    libraryId: library_id,
                    libraryName: libraryResult.rows[0].library_name,
                    confidence: config.confidence,
                });
                applied = true;
            }
        }

        if (!applied) {
            throw new Error(`Unable to apply suggestion type: ${suggestion.suggestion_type}`);
        }

        await completeSuggestionReview(client, { suggestionId, userId, status: 'applied', beforeAccuracy });

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
        await db.withTransaction(async client => {
            await lockPendingSuggestion(client, suggestionId);
            await completeSuggestionReview(client, { suggestionId, userId, status: 'rejected', reason });
        });

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

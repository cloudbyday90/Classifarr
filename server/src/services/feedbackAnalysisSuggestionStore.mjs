import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { resolveSuggestionConfig } from './feedbackAnalysisSuggestionConfig.mjs';
import { NotFoundError, ValidationError } from '../utils/appError.mjs';
import { withServiceCatch } from '../utils/serviceCatch.mjs';

import { assertSuggestionCohortCurrent, assertSuggestionEvidenceCurrent, persistSuggestionCohort } from './feedbackAnalysisCohort.mjs';
import { suggestionEvidenceDigest } from './feedbackAnalysisCohortContract.mjs';

const logger = createLogger('FeedbackAnalysis');

export async function storeSuggestions(policyId, suggestions, cohort) {
    return withServiceCatch(logger, 'Failed to store suggestions', () => db.withTransaction(async client => {
        // A fresh statement snapshot after the policy lock must see the previous writer's inserts.
        await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        const policyResult = await client.query(`
            SELECT *
            FROM library_policies
            WHERE id = $1
            FOR NO KEY UPDATE
        `, [policyId]);

        if (policyResult.rows.length === 0) {
            throw new NotFoundError('Policy not found');
        }

        const policy = policyResult.rows[0];
        await assertSuggestionCohortCurrent(client, cohort, policy);
        const storedSuggestions = [];
        const checkedCohorts = new Set();
        const pending = await client.query("SELECT * FROM policy_tuning_suggestions WHERE policy_id = $1 AND status = 'pending' ORDER BY id FOR UPDATE", [policyId]);
        for (const existing of pending.rows) {
            try {
                await assertSuggestionEvidenceCurrent(client, existing, policy, checkedCohorts);
            } catch (error) {
                if (!['SUGGESTION_EVIDENCE_REQUIRED', 'SUGGESTION_EVIDENCE_STALE'].includes(error.code)) throw error;
                await client.query("UPDATE policy_tuning_suggestions SET status = 'superseded', superseded_at = NOW() WHERE id = $1 AND status = 'pending'", [existing.id]);
            }
        }
        let fingerprint;
        const cohortIds = new Set(cohort.feedback.map(row => row.id));

        for (const suggestion of suggestions) {
            const config = resolveSuggestionConfig(policy, suggestion);
            const configJson = JSON.stringify(config);
            const supportingIds = [...new Set(suggestion.supporting_feedback || [])];
            if (supportingIds.some(id => !cohortIds.has(id))) throw new ValidationError('Suggestion support must belong to its analysis cohort');

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

            fingerprint ??= await persistSuggestionCohort(client, policyId, cohort);
            const result = await client.query(`
                INSERT INTO policy_tuning_suggestions (
                    policy_id,
                    suggestion_type,
                    suggestion_config,
                    supporting_feedback_ids,
                    confidence,
                    impact_estimate,
                    status, cohort_fingerprint, evidence_fingerprint
                )
                VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)
                RETURNING id, suggestion_type, suggestion_config, confidence, impact_estimate, status, created_at
            `, [
                policyId,
                suggestion.type,
                configJson,
                supportingIds,
                suggestion.confidence,
                suggestion.impact_estimate,
                fingerprint,
                suggestionEvidenceDigest(fingerprint, suggestion.type, config, supportingIds)
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

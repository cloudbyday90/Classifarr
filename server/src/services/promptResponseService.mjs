/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ConflictError, NotFoundError, ValidationError } from '../utils/appError.mjs';
import { upsertApprovedPattern } from './approvedPatternWriter.mjs';
import { normalizePromptResponse } from './promptResponseInput.mjs';
import { projectPromptClassification } from './promptClassificationProjection.mjs';
import { assertLegacyPolicyWriteAllowed } from './policyLegacyWriteGuard.mjs';
import { POLICY_LEGACY_WRITE_OPERATION_IDS } from './policyLegacyWriteBoundary.mjs';

export async function respondToPrompt({ db, feedbackAnalysis, id, body }) {
    const { selectedLibraryId, selectedPolicyId, patternActions, reasons, customReason } = normalizePromptResponse(body);
    const libraryIds = [...new Set([selectedLibraryId, ...patternActions.map(action => action.targetLibraryId)])].sort((a, b) => a - b);
    return db.withTransaction(async client => {
        // Policy first matches suggestion application and serializes prompt learning-stat updates.
        await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        const policies = (await client.query(`
            SELECT lp.*, EXISTS (SELECT 1 FROM policy_intents pi WHERE pi.policy_id=lp.id AND pi.active=TRUE) AS native_intent_active
            FROM library_policies lp WHERE lp.library_id=ANY($1::integer[]) OR lp.id=$2
            ORDER BY lp.id FOR UPDATE
        `, [libraryIds, selectedPolicyId])).rows;
        if (selectedPolicyId && !policies.some(policy => policy.id === selectedPolicyId && policy.library_id === selectedLibraryId)) {
            throw new ValidationError('Selected policy must belong to the selected library');
        }
        for (const policy of policies) {
            if (patternActions.some(action => action.targetLibraryId === policy.library_id)) {
                assertLegacyPolicyWriteAllowed({ policy,
                    operationId: POLICY_LEGACY_WRITE_OPERATION_IDS.APPLY_LEGACY_TUNING_SUGGESTION,
                    payload: { suggestion_type: 'create_pattern' } });
            }
        }
        const libraries = (await client.query(`
            SELECT id, name, media_type, is_active FROM libraries
            WHERE id=ANY($1::integer[]) ORDER BY id FOR SHARE
        `, [libraryIds])).rows;
        const classification = (await client.query(`
            SELECT id, tmdb_id, media_type, title, metadata, confidence, status,
                created_at AT TIME ZONE 'UTC' AS created_at
            FROM classification_history WHERE id=$1 FOR UPDATE
        `, [id])).rows[0];
        if (!classification) throw new NotFoundError('Classification not found');
        if (classification.status !== 'pending') {
            throw new ConflictError('This prompt is no longer pending', { code: 'PROMPT_NOT_PENDING' });
        }
        if (libraries.length !== libraryIds.length || libraries.some(library => !library.is_active || library.media_type !== classification.media_type)) {
            throw new ValidationError('Pattern and selected destinations must be active libraries with the matching media type');
        }
        const persistedIds = new Set();
        // Stable pattern lock order also covers destinations without a policy row.
        const orderedActions = [...patternActions].sort((left, right) => {
            const a = JSON.stringify([left.targetLibraryId, left.type, left.value]);
            const b = JSON.stringify([right.targetLibraryId, right.type, right.value]);
            return a < b ? -1 : a > b ? 1 : 0;
        });
        for (const action of orderedActions) {
            const library = libraries.find(candidate => candidate.id === action.targetLibraryId);
            persistedIds.add(await upsertApprovedPattern(client, {
                type: action.type, value: action.value, libraryId: library.id, libraryName: library.name, confidence: 75,
            }));
        }
        const { metadata, evaluation } = projectPromptClassification(classification);
        const topSuggestion = evaluation.ranked[0];
        const feedbackId = await feedbackAnalysis.recordFeedback({
            tmdb_id: classification.tmdb_id, media_type: classification.media_type, title: classification.title,
            item_metadata: metadata, prompt_type: evaluation.action,
            original_scores: evaluation.scores,
            top_suggestion_library_id: topSuggestion?.library_id,
            top_suggestion_score: topSuggestion?.score,
            selected_library_id: selectedLibraryId, selected_policy_id: selectedPolicyId,
            was_correction: topSuggestion?.library_id != null ? Number(topSuggestion.library_id) !== selectedLibraryId : null,
            user_reason: reasons, user_reason_text: customReason, signal_analysis: evaluation.scores,
            patterns_created: patternActions, source: 'web',
            prompted_at: classification.created_at, responded_at: new Date(),
        }, client);
        await client.query(`
            UPDATE classification_history SET status='completed', library_id=$1, library_name=$2,
                pending_reason=NULL, pending_identity_key=NULL WHERE id=$3
        `, [selectedLibraryId, libraries.find(library => library.id === selectedLibraryId).name, id]);
        return { feedbackId, classificationId: id, patternsCreated: persistedIds.size };
    });
}

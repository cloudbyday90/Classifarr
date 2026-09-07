/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isLearningLibraryId } from './autoLearningFeedbackEvidence.mjs';

/** Read current evidence for suggestion analysis; never reconstruct historical destinations. */
export async function readEligiblePolicyFeedback(client, policyId, days = 30, capture = null) {
    if (!isLearningLibraryId(policyId) || !Number.isInteger(days) || days < 1 || days > 365) {
        return [];
    }

    const result = await client.query(`
        SELECT feedback.id, feedback.selected_policy_id, feedback.selected_library_id,
            feedback.was_correction, feedback.item_metadata, feedback.original_scores,
            feedback.top_suggestion_library_id, feedback.top_suggestion_score, feedback.prompt_type, feedback.prompted_at
        FROM policy_feedback_evaluation feedback
        JOIN library_policies policy ON policy.id = feedback.selected_policy_id
            AND policy.library_id = feedback.selected_library_id
        JOIN libraries destination ON destination.id = feedback.selected_library_id
            AND destination.is_active IS TRUE
        WHERE feedback.selected_policy_id = $1
            AND feedback.evaluation_correct IS NOT NULL
            AND feedback.selected_library_id > 0
            AND feedback.prompted_at >= NOW() - INTERVAL '1 day' * $2
            ${capture ? 'AND feedback.prompted_at <= $3::timestamptz' : ''}
        ORDER BY feedback.prompted_at DESC, feedback.id DESC
        ${capture ? 'LIMIT $4' : ''}
    `, capture ? [policyId, days, capture.capturedAt, capture.limit] : [policyId, days]);

    return result.rows.filter(row => isLearningLibraryId(row?.selected_library_id)
        && row.selected_policy_id === policyId);
}

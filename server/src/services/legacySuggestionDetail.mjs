/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { NotFoundError } from '../utils/appError.mjs';

/** Preserve the shipped legacy response fields during the migration window. */
export async function readLegacySuggestionDetail(db, id) {
    const { rows: [suggestion] } = await db.query(`
        SELECT pts.id, pts.policy_id, pts.suggestion_type, pts.suggestion_config,
            pts.supporting_feedback_ids, pts.confidence, pts.impact_estimate, pts.status,
            pts.reviewed_at, pts.reviewed_by, pts.rejection_reason, pts.created_at,
            pts.applied_at, pts.applied_by, pts.before_accuracy,
            pts.cohort_fingerprint, pts.evidence_fingerprint, pts.superseded_at,
            lp.name AS policy_name, l.name AS library_name
        FROM policy_tuning_suggestions pts
        JOIN library_policies lp ON pts.policy_id = lp.id
        JOIN libraries l ON lp.library_id = l.id
        WHERE pts.id = $1
    `, [id]);
    if (!suggestion) throw new NotFoundError('Suggestion not found');

    const feedbackIds = suggestion.supporting_feedback_ids || [];
    if (!feedbackIds.length) return { ...suggestion, supporting_feedback: [] };

    const { rows: feedback } = await db.query(`
        SELECT pfl.id, pfl.tmdb_id, pfl.media_type, pfl.title, pfl.item_metadata,
            pfl.prompt_type, pfl.original_scores, pfl.top_suggestion_library_id, pfl.top_suggestion_score,
            pfl.selected_library_id, pfl.selected_policy_id, pfl.was_correction, pfl.user_reason,
            pfl.user_reason_text, pfl.patterns_created, pfl.signal_analysis, pfl.prompted_at,
            pfl.responded_at, pfl.response_time_seconds, pfl.source,
            l.name AS original_library, l2.name AS selected_library
        FROM policy_feedback_log pfl
        LEFT JOIN libraries l ON pfl.top_suggestion_library_id = l.id
        LEFT JOIN libraries l2 ON pfl.selected_library_id = l2.id
        WHERE pfl.id = ANY($1)
        ORDER BY pfl.prompted_at DESC
    `, [feedbackIds]);
    return { ...suggestion, supporting_feedback: feedback };
}

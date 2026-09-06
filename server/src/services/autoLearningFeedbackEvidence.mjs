/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const DEFAULT_LOOKBACK_DAYS = 30;

export function isLearningLibraryId(value) {
    return Number.isInteger(value) && value > 0 && value <= 2147483647;
}

/** Historical snapshots are never a fallback for a missing live destination. */
export async function readEligibleLearningFeedback(client, libraryId) {
    if (!isLearningLibraryId(libraryId)) return [];
    const result = await client.query(`
        SELECT feedback.selected_library_id, feedback.was_correction, feedback.item_metadata
        FROM policy_feedback_log feedback
        JOIN libraries destination ON destination.id = feedback.selected_library_id
            AND destination.is_active IS TRUE
        WHERE feedback.prompted_at >= NOW() - $1::interval
            AND feedback.selected_library_id > 0
            AND EXISTS (
                SELECT 1 FROM libraries candidate
                WHERE candidate.id = $2 AND candidate.is_active IS TRUE
            )
    `, [`${DEFAULT_LOOKBACK_DAYS} days`, libraryId]);

    return result.rows.filter(row => isLearningLibraryId(row?.selected_library_id));
}

/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const EVIDENCE_COVERAGE_GROUP_LIMIT = 200;

// Separate populations prevent a corrected destination from changing history attribution.
export const EVIDENCE_COVERAGE_SQL = `WITH history_groups AS MATERIALIZED (
    SELECT history.library_id, library.name AS library_name, library.is_active AS library_active,
        COALESCE(history.method, 'unknown_method') AS method,
        count(*) AS events,
        count(*) FILTER (WHERE history.method = 'source_library') AS imported_observations,
        count(*) FILTER (WHERE CASE
            WHEN jsonb_typeof(history.metadata #> '{classification_details,ranked_candidates}') = 'array'
                AND jsonb_typeof(history.metadata #> '{classification_details,ranked_candidates,0}') = 'object'
            THEN CASE WHEN (history.metadata #>> '{classification_details,ranked_candidates,0,library_id}') ~ '^[1-9][0-9]{0,9}$'
                THEN (history.metadata #>> '{classification_details,ranked_candidates,0,library_id}')::bigint <= 2147483647
                ELSE FALSE END
            ELSE FALSE END) AS original_candidates,
        count(source.feedback_id) AS linked_feedback
    FROM classification_history history
    LEFT JOIN libraries library ON library.id = history.library_id
    LEFT JOIN policy_feedback_sources source ON source.classification_id = history.id
    GROUP BY history.library_id, library.name, library.is_active, history.method
), feedback_groups AS MATERIALIZED (
    SELECT feedback.selected_library_id AS library_id, library.name AS library_name, library.is_active AS library_active,
        CASE WHEN source.classification_id IS NULL THEN 'unlinked_feedback'
            WHEN history.id IS NULL THEN 'source_history_removed'
            ELSE COALESCE(history.method, 'unknown_method') END AS method,
        count(*) AS observations,
        count(source.classification_id) AS source_bound,
        count(feedback.evaluation_correct) AS evaluated,
        count(*) FILTER (WHERE feedback.evaluation_correct IS NULL) AS unevaluated
    FROM policy_feedback_evaluation feedback
    LEFT JOIN policy_feedback_sources source ON source.feedback_id = feedback.id
    LEFT JOIN classification_history history ON history.id = source.classification_id
    LEFT JOIN libraries library ON library.id = feedback.selected_library_id
    GROUP BY feedback.selected_library_id, library.name, library.is_active,
        CASE WHEN source.classification_id IS NULL THEN 'unlinked_feedback'
            WHEN history.id IS NULL THEN 'source_history_removed'
            ELSE COALESCE(history.method, 'unknown_method') END
)
SELECT statement_timestamp() AS captured_at,
    (SELECT jsonb_build_object('events', COALESCE(sum(events), 0),
        'imported_observations', COALESCE(sum(imported_observations), 0),
        'original_candidates', COALESCE(sum(original_candidates), 0),
        'linked_feedback', COALESCE(sum(linked_feedback), 0)) FROM history_groups) AS history_totals,
    (SELECT count(*) FROM history_groups) AS history_group_count,
    COALESCE((SELECT jsonb_agg(to_jsonb(selected) ORDER BY library_id NULLS LAST, method)
        FROM (SELECT * FROM history_groups ORDER BY library_id NULLS LAST, method LIMIT $1) selected), '[]') AS history_groups,
    (SELECT jsonb_build_object('observations', COALESCE(sum(observations), 0),
        'source_bound', COALESCE(sum(source_bound), 0), 'evaluated', COALESCE(sum(evaluated), 0),
        'unevaluated', COALESCE(sum(unevaluated), 0)) FROM feedback_groups) AS feedback_totals,
    (SELECT count(*) FROM feedback_groups) AS feedback_group_count,
    COALESCE((SELECT jsonb_agg(to_jsonb(selected) ORDER BY library_id NULLS LAST, method)
        FROM (SELECT * FROM feedback_groups ORDER BY library_id NULLS LAST, method LIMIT $1) selected), '[]') AS feedback_groups,
    (SELECT count(*) FROM policy_feedback_sources WHERE feedback_id IS NULL) AS deleted_feedback_receipts`;

export async function readEvidenceCoverageSnapshot(db) {
    return db.withTransaction(async client => {
        await client.query('SET TRANSACTION READ ONLY');
        await client.query("SET LOCAL statement_timeout = '5s'");
        return (await client.query(EVIDENCE_COVERAGE_SQL, [EVIDENCE_COVERAGE_GROUP_LIMIT])).rows[0];
    });
}

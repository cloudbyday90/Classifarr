/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { EVIDENCE_CANDIDATE_STATUS_SQL, EVIDENCE_EXPLICIT_CAPTURE_STATUS_SQL } from './evidenceCandidateCoverageSql.mjs';
import { EVIDENCE_PROVENANCE_STATUS_SQL, EVIDENCE_ORIGINAL_METHOD_SQL, EVIDENCE_CANDIDATE_SOURCE_SQL,
    EVIDENCE_ORIGINAL_CANDIDATE_LIBRARY_SQL,
    EVIDENCE_ATTRIBUTION_GROUPS_SQL, EVIDENCE_ATTRIBUTION_SELECT_SQL } from './evidenceMethodAttributionSql.mjs';
import { DAILY_PROVENANCE_CTES_SQL, DAILY_PROVENANCE_SELECT_SQL } from './dailyProvenanceCoverageSql.mjs';
import { UTC_PROVENANCE_CTES_SQL, UTC_PROVENANCE_SELECT_SQL } from './utcProvenanceCoverageSql.mjs';
import { LIBRARY_UTC_GROUPS_SQL, LIBRARY_UTC_SELECT_SQL } from './libraryUtcCoverageSql.mjs';
export const EVIDENCE_COVERAGE_GROUP_LIMIT = 200;

// Separate populations prevent a corrected destination from changing history attribution.
export const EVIDENCE_COVERAGE_SQL = `WITH history_evidence AS MATERIALIZED (
    SELECT id, library_id, method, created_at, recorded_at, CASE
        WHEN status IN ('completed', 'corrected', 'verified', 'routed') THEN 'completed'
        WHEN status IN ('pending', 'awaiting_decision') THEN 'pending'
        WHEN status = 'pending_retry' THEN 'retry'
        ELSE 'other' END AS evidence_lifecycle,
        ${EVIDENCE_CANDIDATE_STATUS_SQL} AS evidence_candidate_status,
        ${EVIDENCE_PROVENANCE_STATUS_SQL} AS provenance_status,
        ${EVIDENCE_ORIGINAL_METHOD_SQL} AS original_method,
        ${EVIDENCE_CANDIDATE_SOURCE_SQL} AS candidate_source,
        ${EVIDENCE_ORIGINAL_CANDIDATE_LIBRARY_SQL} AS original_candidate_library_id
    FROM (SELECT id, library_id, method, status, metadata, created_at, recorded_at,
        ${EVIDENCE_EXPLICIT_CAPTURE_STATUS_SQL} AS capture_status
        FROM classification_history) classification_history
), history_groups AS MATERIALIZED (
    SELECT history.library_id, library.name AS library_name, library.is_active AS library_active,
        COALESCE(history.method, 'unknown_method') AS method,
        count(*) AS events,
        count(*) FILTER (WHERE history.evidence_lifecycle = 'completed') AS completed_events,
        count(*) FILTER (WHERE history.evidence_lifecycle = 'pending') AS pending_events,
        count(*) FILTER (WHERE history.evidence_lifecycle = 'retry') AS retry_events,
        count(*) FILTER (WHERE history.evidence_lifecycle = 'other') AS other_events,
        count(*) FILTER (WHERE history.method = 'source_library') AS imported_observations,
        count(*) FILTER (WHERE history.evidence_candidate_status = 'recorded') AS original_candidates,
        count(*) FILTER (WHERE history.evidence_candidate_status = 'no_candidate') AS candidate_no_proposal,
        count(*) FILTER (WHERE history.evidence_candidate_status = 'invalid_candidate') AS candidate_invalid,
        count(*) FILTER (WHERE history.evidence_candidate_status = 'not_applicable') AS candidate_not_applicable,
        count(*) FILTER (WHERE history.evidence_candidate_status = 'unrecorded') AS candidate_unrecorded,
        count(source.feedback_id) AS linked_feedback
    FROM history_evidence history
    LEFT JOIN libraries library ON library.id = history.library_id
    LEFT JOIN policy_feedback_sources source ON source.classification_id = history.id
    GROUP BY history.library_id, library.name, library.is_active, history.method
), ${EVIDENCE_ATTRIBUTION_GROUPS_SQL}, ${DAILY_PROVENANCE_CTES_SQL}, ${UTC_PROVENANCE_CTES_SQL}, ${LIBRARY_UTC_GROUPS_SQL}, feedback_groups AS MATERIALIZED (
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
    (SELECT jsonb_build_object('events', count(*),
        'recorded_events', count(*) FILTER (WHERE isfinite(recorded_at)),
        'unknown_events', count(*) FILTER (WHERE recorded_at IS NULL))
        FROM history_evidence) AS recording_time_coverage,
    ${EVIDENCE_ATTRIBUTION_SELECT_SQL}
    ${DAILY_PROVENANCE_SELECT_SQL}
    ${UTC_PROVENANCE_SELECT_SQL}
    ${LIBRARY_UTC_SELECT_SQL}
    (SELECT jsonb_build_object('events', COALESCE(sum(events), 0),
        'completed_events', COALESCE(sum(completed_events), 0),
        'pending_events', COALESCE(sum(pending_events), 0),
        'retry_events', COALESCE(sum(retry_events), 0),
        'other_events', COALESCE(sum(other_events), 0),
        'imported_observations', COALESCE(sum(imported_observations), 0),
        'original_candidates', COALESCE(sum(original_candidates), 0),
        'candidate_no_proposal', COALESCE(sum(candidate_no_proposal), 0),
        'candidate_invalid', COALESCE(sum(candidate_invalid), 0),
        'candidate_not_applicable', COALESCE(sum(candidate_not_applicable), 0),
        'candidate_unrecorded', COALESCE(sum(candidate_unrecorded), 0),
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

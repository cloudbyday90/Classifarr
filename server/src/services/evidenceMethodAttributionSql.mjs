/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const capture = "classification_history.metadata #> '{classification_details,candidate_capture}'";
export const EVIDENCE_PROVENANCE_STATUS_SQL = `CASE
    WHEN (${capture}) IS NULL THEN 'unrecorded'
    WHEN classification_history.capture_status IS NULL THEN 'invalid'
    WHEN classification_history.capture_status = 'unsupported_method' THEN 'unsupported'
    ELSE 'captured' END`;

// A valid envelope retains provenance even when it records no or an invalid candidate.
export const EVIDENCE_ORIGINAL_METHOD_SQL = `CASE
    WHEN classification_history.capture_status IS NOT NULL
        AND classification_history.capture_status <> 'unsupported_method'
    THEN (${capture}) ->> 'method' ELSE NULL END`;
export const EVIDENCE_CANDIDATE_SOURCE_SQL = `CASE
    WHEN classification_history.capture_status IS NOT NULL
        AND classification_history.capture_status <> 'unsupported_method'
    THEN (${capture}) ->> 'source' ELSE NULL END`;

// The capture validator checks syntax and int4 range before this conditional cast.
export const EVIDENCE_ORIGINAL_CANDIDATE_LIBRARY_SQL = `CASE
    WHEN classification_history.capture_status = 'recorded'
    THEN ((${capture}) ->> 'library_id')::integer ELSE NULL END`;

const order = 'library_id NULLS LAST, original_method NULLS LAST, candidate_source NULLS LAST, recorded_method, provenance_status';
export const EVIDENCE_ATTRIBUTION_GROUPS_SQL = `attribution_groups AS MATERIALIZED (
    SELECT history.library_id, library.name AS library_name, library.is_active AS library_active,
        history.original_method, history.candidate_source,
        COALESCE(history.method, 'unknown_method') AS recorded_method, history.provenance_status,
        count(*) AS events
    FROM history_evidence history
    LEFT JOIN libraries library ON library.id = history.library_id
    GROUP BY history.library_id, library.name, library.is_active, history.original_method,
        history.candidate_source, COALESCE(history.method, 'unknown_method'), history.provenance_status
)`;
export const EVIDENCE_ATTRIBUTION_SELECT_SQL = `
    (SELECT jsonb_build_object('events', COALESCE(sum(events), 0),
        'captured_events', COALESCE(sum(events) FILTER (WHERE provenance_status = 'captured'), 0),
        'unrecorded_events', COALESCE(sum(events) FILTER (WHERE provenance_status = 'unrecorded'), 0),
        'invalid_events', COALESCE(sum(events) FILTER (WHERE provenance_status = 'invalid'), 0),
        'unsupported_events', COALESCE(sum(events) FILTER (WHERE provenance_status = 'unsupported'), 0))
        FROM attribution_groups) AS attribution_totals,
    (SELECT count(*) FROM attribution_groups) AS attribution_group_count,
    COALESCE((SELECT jsonb_agg(to_jsonb(selected) ORDER BY ${order})
        FROM (SELECT * FROM attribution_groups ORDER BY ${order} LIMIT $1) selected), '[]') AS attribution_groups,`;

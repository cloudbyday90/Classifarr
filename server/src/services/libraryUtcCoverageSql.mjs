/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { PROVENANCE_STATUSES } from './evidenceProvenanceProjection.mjs';
import { LIBRARY_UTC_COUNT_FIELDS } from './libraryUtcCoverageCounts.mjs';
export const LIBRARY_UTC_GROUPS_SQL = `utc_library_groups AS MATERIALIZED (
    SELECT history.library_id, library.name AS library_name, library.is_active AS library_active,
        count(*) AS retained_events,
        count(*) FILTER (WHERE time_scope = 'window') AS events,
        ${PROVENANCE_STATUSES.map(status => `count(*) FILTER (WHERE time_scope = 'window' AND provenance_status = '${status}') AS ${status}_events`).join(',\n        ')},
        count(*) FILTER (WHERE time_scope = 'older') AS older_events,
        count(*) FILTER (WHERE time_scope = 'future') AS future_events,
        count(*) FILTER (WHERE time_scope = 'unknown') AS unknown_events
    FROM utc_trend_population history LEFT JOIN libraries library ON library.id = history.library_id
    GROUP BY history.library_id, library.name, library.is_active
)`;

export const LIBRARY_UTC_SELECT_SQL = `
    (SELECT jsonb_build_object(${LIBRARY_UTC_COUNT_FIELDS.map(field => `'${field}', COALESCE(sum(${field}), 0)`).join(', ')})
        FROM utc_library_groups) AS utc_library_totals,
    (SELECT count(*) FROM utc_library_groups) AS utc_library_group_count,
    COALESCE((SELECT jsonb_agg(to_jsonb(selected) ORDER BY library_id NULLS LAST)
        FROM (SELECT * FROM utc_library_groups ORDER BY library_id NULLS LAST LIMIT $1) selected), '[]') AS utc_library_groups,`;

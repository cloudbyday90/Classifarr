/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

// Shared by the Command Center total and its drill-down. No rotating window or
// preview limit: pagination limits output, never the population being counted.
export const COMPLETE_SOURCE_CAPTURES_CTE = `complete_captures AS MATERIALIZED (
    SELECT c.library_id, c.media_server_id, c.generation
    FROM media_source_capture_state c JOIN libraries l ON l.id=c.library_id
    WHERE l.is_active AND c.media_server_id=l.media_server_id
        AND c.phase='complete' AND c.mode='full'
        AND c.omitted_count=0 AND c.uncapturable_count=0
        AND c.started_at >= statement_timestamp()-INTERVAL '30 days'
)`;

export const CURRENT_SOURCE_ISSUE_JOIN = `FROM complete_captures c JOIN media_source_observations o
        ON o.library_id=c.library_id AND o.media_server_id=c.media_server_id
        AND o.generation=c.generation
        AND o.last_seen_at >= statement_timestamp()-INTERVAL '30 days'`;

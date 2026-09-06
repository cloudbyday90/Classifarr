/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// These CTEs consume the already bounded points snapshot, never media inventory.
export const libraryObservationDiagnosticsCtes = `incremental_visits AS (
    SELECT "libraryId", bool_or(status = 'available') AS completed
    FROM points WHERE "measurementVersion" = 3 GROUP BY "libraryId"
), active_catalog AS (
    SELECT l.id, v."libraryId" IS NOT NULL AS visited, COALESCE(v.completed, false) AS completed
    FROM libraries l LEFT JOIN incremental_visits v ON v."libraryId" = l.id
    WHERE l.is_active = true
)`;

export const libraryObservationDiagnosticsCatalog = `(SELECT jsonb_build_object(
    'activeLibraryCount', count(*)::integer,
    'withIncrementalVisits', (count(*) FILTER (WHERE visited))::integer,
    'withCompletedScans', (count(*) FILTER (WHERE completed))::integer,
    'withoutCompletedScans', (count(*) FILTER (WHERE NOT completed))::integer,
    'withoutIncrementalVisits', (count(*) FILTER (WHERE NOT visited))::integer,
    'unvisitedLibraryIds', ARRAY(SELECT id FROM active_catalog WHERE NOT visited ORDER BY id LIMIT 12),
    'unvisitedPreviewLimit', 12,
    'unvisitedOmittedCount', greatest(0, (count(*) FILTER (WHERE NOT visited))::integer - 12)
) FROM active_catalog)`;

/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { sourceIdentityDiagnostics } from './mediaSyncIdentityDiagnostics.mjs';
import {
  SOURCE_CONFLICT_LIBRARY_WINDOW_LIMITS,
  sourceConflictLibraryWindowCtes,
} from './sourceConflictLibraryWindow.mjs';

export const SOURCE_REPAIR_WORKLIST_LIMITS = Object.freeze({
  maximumEntries: 32,
  maximumEntriesPerLibrary: 8,
  libraryLimit: SOURCE_CONFLICT_LIBRARY_WINDOW_LIMITS.libraryLimit,
  retentionDays: 30,
});

const SELECT_SOURCE_REPAIR_WORKLIST = `WITH ${sourceConflictLibraryWindowCtes('$4::integer')},
current_conflicts AS MATERIALIZED (
  SELECT l.id AS library_id, l.name AS library_name, l.media_server_id, o.external_id,
    o.title, o.year, o.media_type, o.provider_fields, o.last_seen_at,
    row_number() OVER (PARTITION BY l.id ORDER BY o.last_seen_at DESC, o.external_id) AS library_rank
  FROM selected_libraries AS l
  JOIN media_source_capture_state AS capture ON capture.library_id=l.id
    AND capture.media_server_id=l.media_server_id
    AND capture.phase='complete' AND capture.mode='full'
    AND capture.omitted_count=0 AND capture.uncapturable_count=0
  CROSS JOIN LATERAL (
    SELECT external_id, title, year, media_type, provider_fields, last_seen_at
    FROM media_source_observations
    WHERE library_id=l.id AND media_server_id=l.media_server_id
      AND generation=capture.generation
      AND identity_issue='conflicting_provider_ids'
      AND last_seen_at >= statement_timestamp()-$3::integer*INTERVAL '1 day'
    ORDER BY last_seen_at DESC, external_id
    LIMIT $1::integer
  ) AS o
), selected AS MATERIALIZED (
  SELECT * FROM current_conflicts
  ORDER BY library_rank, library_id, last_seen_at DESC, external_id
  LIMIT $2::integer
)
SELECT statement_timestamp() AS observed_at,
  COALESCE((SELECT MAX(active_library_count)::integer FROM active_libraries), 0) AS active_library_count,
  (SELECT COUNT(*)::integer FROM selected_libraries) AS selected_library_count,
  selected.library_id, selected.library_name, selected.media_server_id, selected.external_id,
  selected.title, selected.year, selected.media_type, selected.provider_fields, selected.last_seen_at
FROM (SELECT true) AS anchor
LEFT JOIN selected ON true
ORDER BY selected.library_rank, selected.library_id, selected.last_seen_at DESC, selected.external_id`;

function toEntry(row) {
  const diagnostics = sourceIdentityDiagnostics(row.media_server_id, row.library_id, {
    external_id: row.external_id,
    media_type: row.media_type,
    provider_identity_invalid: true,
    provider_identity_issue: 'conflicting_provider_ids',
  });
  return Object.freeze({
    sourceFingerprint: diagnostics.sourceFingerprint,
    library: Object.freeze({ name: row.library_name }),
    title: row.title,
    year: row.year,
    mediaType: row.media_type,
    identityIssue: diagnostics.identityIssue,
    providerFields: row.provider_fields,
    lastSeenAt: row.last_seen_at,
    repairActionId: 'correct_source_match_then_resync',
  });
}

/**
 * Produces a bounded, read-only source-repair queue from fresh, complete
 * captures. It deliberately neither reads a media server nor writes identity
 * data: matching is repaired at the source and verified by a later sync.
 */
export async function readSourceRepairWorklist(db) {
  const limits = SOURCE_REPAIR_WORKLIST_LIMITS;
  const { rows } = await db.query(SELECT_SOURCE_REPAIR_WORKLIST, [
    limits.maximumEntriesPerLibrary,
    limits.maximumEntries,
    limits.retentionDays,
    limits.libraryLimit,
  ]);
  const first = rows[0];
  const selectedRows = rows.filter((row) => Number.isSafeInteger(row.library_id));
  const entries = selectedRows.map(toEntry);
  return Object.freeze({
    version: 'library.source_repair_worklist.v1',
    status: Object.freeze({ id: entries.length ? 'complete' : 'no_current_conflicts' }),
    observedAt: new Date(first.observed_at).toISOString(),
    scope: Object.freeze({
      ...limits,
      librarySelection: SOURCE_CONFLICT_LIBRARY_WINDOW_LIMITS.librarySelection,
      activeLibraryCount: first.active_library_count,
      selectedLibraryCount: first.selected_library_count,
      excludedLibraryCount: first.active_library_count-first.selected_library_count,
      selectedEntryCount: entries.length,
    }),
    conflictCategories: Object.freeze(entries.length
      ? [{ id: 'conflicting_provider_ids', count: entries.length }]
      : []),
    entries: Object.freeze(entries),
  });
}

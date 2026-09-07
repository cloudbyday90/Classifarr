/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { SOURCE_OBSERVATION_LIMITS } from './mediaSourceObservationContract.mjs';
import { sourceIdentityDiagnostics } from './mediaSyncIdentityDiagnostics.mjs';

export async function readSourceObservationSummary(db) {
  const limits = SOURCE_OBSERVATION_LIMITS;
  const { rows } = await db.query(`WITH selected AS MATERIALIZED (
    SELECT id,name,media_server_id FROM libraries WHERE is_active=true ORDER BY id LIMIT $1
  ), observed AS MATERIALIZED (
    SELECT l.id AS library_id, o.* FROM selected l CROSS JOIN LATERAL (
      SELECT external_id,title,year,media_type,identity_issue,provider_fields,first_seen_at,last_seen_at
      FROM media_source_observations WHERE library_id=l.id AND media_server_id=l.media_server_id
        AND last_seen_at >= statement_timestamp()-$2::integer*INTERVAL '1 day'
      ORDER BY last_seen_at DESC,external_id LIMIT $3
    ) o
  ) SELECT statement_timestamp() AS observed_at,
    (SELECT COUNT(*)::integer FROM libraries WHERE is_active=true) AS active_count,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'mediaServerId',l.media_server_id,
      'capture',CASE WHEN s.library_id IS NULL THEN NULL ELSE jsonb_build_object(
        'phase',s.phase,'mode',s.mode,'source',s.source,'startedAt',s.started_at,'completedAt',s.completed_at,
        'observedCount',s.observed_count,'rejectedCount',s.rejected_count,'uncapturableCount',s.uncapturable_count,'omittedCount',s.omitted_count) END,
      'retainedCount',(SELECT COUNT(*)::integer FROM observed o WHERE o.library_id=l.id),
      'examples',COALESCE((SELECT jsonb_agg(p) FROM (
        SELECT external_id,title,year,media_type,identity_issue,provider_fields,first_seen_at,last_seen_at
        FROM observed o WHERE o.library_id=l.id ORDER BY last_seen_at DESC,external_id LIMIT $4
      ) p),'[]'::jsonb)) ORDER BY l.id) FROM selected l LEFT JOIN media_source_capture_state s
        ON s.library_id=l.id AND s.media_server_id=l.media_server_id),'[]'::jsonb) AS libraries`,
  [limits.libraryLimit, limits.retentionDays, limits.retainedPerLibrary + 1, limits.previewPerLibrary]);
  const snapshot = rows[0];
  return { version: 'library.source_observations.v1', observedAt: new Date(snapshot.observed_at).toISOString(),
    scope: { ...limits, activeLibraryCount: snapshot.active_count, selectedLibraryCount: snapshot.libraries.length,
      excludedLibraryCount: snapshot.active_count-snapshot.libraries.length },
    libraries: snapshot.libraries.map(library => {
      const { capture } = library;
      const exceeded = library.retainedCount > limits.retainedPerLibrary;
      const expired = capture && Date.parse(capture.startedAt) < Date.parse(snapshot.observed_at)-limits.retentionDays*86400000;
      const status = exceeded ? 'capacity_exceeded' : !capture ? 'not_captured' : expired ? 'expired' : capture.phase !== 'complete' ? capture.phase :
        capture.mode !== 'full' || capture.omittedCount || capture.uncapturableCount ? 'partial' : 'complete';
      return { id: library.id, name: library.name, status, capture,
        retainedCount: exceeded ? null : library.retainedCount,
        examples: exceeded ? [] : library.examples.map(item => ({
          sourceFingerprint: sourceIdentityDiagnostics(library.mediaServerId, library.id, item).sourceFingerprint,
          title: item.title, year: item.year, mediaType: item.media_type, identityIssue: item.identity_issue,
          providerFields: item.provider_fields, firstSeenAt: item.first_seen_at, lastSeenAt: item.last_seen_at,
        })) };
    }) };
}

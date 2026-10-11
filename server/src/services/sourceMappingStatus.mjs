/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { sourceMappingDiagnostic } from './sourceMappingDiagnostics.mjs';
import { INGESTION_OWNER_ACTIVE_SQL } from './libraryIngestionPredicates.mjs';

// Fixed aliases from the saved-mappings query. A read-only hint, never admission.
export const SOURCE_MAPPING_RECHECK_ACTIVE_SQL = `(
  l.is_active AND l.media_server_id=m.media_server_id AND l.media_type=m.media_type
  AND o.source_digest=m.source_digest
  AND EXISTS (SELECT 1 FROM media_server ms WHERE ms.id=m.media_server_id AND ms.is_active)
  AND EXISTS (SELECT 1 FROM library_ingestion_state s
    JOIN media_source_capture_state c ON c.library_id=s.library_id AND c.generation=s.capture_generation
    JOIN media_server_sync_status sync ON sync.id=s.sync_status_id AND sync.library_id=s.library_id
    WHERE s.library_id=l.id AND s.phase='running'
      AND c.media_server_id=m.media_server_id AND c.phase='collecting' AND c.source='media_sync'
      AND o.generation=c.generation AND sync.media_server_id=m.media_server_id AND sync.status='running')
  AND ${INGESTION_OWNER_ACTIVE_SQL})`;

/** Preserve v1 completion/failure states; add history without granting authority. */
export function sourceMappingStatus(row) {
  const diagnostic = row.revoked_at ? null : sourceMappingDiagnostic(row.last_outcome);
  const status = row.revoked_at ? 'revoked' : diagnostic ? 'verification_deferred'
    : row.materialized_at && row.current_receipt ? 'materialized' : 'awaiting_sync';
  return {
    status, diagnostic, lastAppliedAt: row.materialized_at ?? null,
    recheckState: status === 'awaiting_sync' && row.materialized_at
      ? row.recheck_active === true ? 'active' : 'waiting' : null,
  };
}

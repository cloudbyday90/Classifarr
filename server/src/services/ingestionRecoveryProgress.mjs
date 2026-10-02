/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ServiceUnavailableError } from '../utils/appError.mjs';
import { INGESTION_OWNER_ACTIVE_SQL, INGESTION_FOREIGN_MARKERS_SQL } from './libraryIngestionPredicates.mjs';
import { SOURCE_CONTENT_COOLING_SQL } from './sourceContentStatus.mjs';
import { RECOVERY_SOURCE_MATCH_SQL } from './ingestionRecoverySource.mjs';

export function projectRecoveryProgress(row, receipt) {
  if (!row) return { stage: 'not_tracked', reason: 'older_receipt' };
  if (row.request_id !== receipt.requestId || row.library_id !== receipt.libraryId) {
    throw new ServiceUnavailableError('Recovery progress could not be verified');
  }
  let stage = row.stage, reason = row.reason;
  if (!['completed', 'superseded'].includes(stage)) {
    if (!row.source_matches) { stage = 'superseded'; reason = 'source_changed'; }
    else if (row.current_run_id !== row.run_id) { stage = 'superseded'; reason = 'new_scan'; }
    else if (!row.library_enabled || row.archived_at || !row.source_enabled) { stage = 'blocked'; reason = 'disabled'; }
    else if (!row.configured) { stage = 'blocked'; reason = 'unconfigured'; }
    else if (row.foreign_markers) { stage = 'blocked'; reason = 'ownership_review'; }
    else if (row.source_cooling) { stage = 'waiting'; reason = 'source_retry'; }
    else if (stage === 'importing' && (!row.owner_active || row.ingestion_phase === 'retry_wait')) {
      stage = 'waiting'; reason = 'import_retry';
    } else if (stage === 'backfilling') {
      if (row.identity_unresolved) { stage = 'blocked'; reason = 'source_ids'; }
      else if (!row.handoff_complete) reason = 'enqueue_pending';
      else if (row.metadata_blocked > 0) { stage = 'blocked'; reason = 'metadata_failures'; }
      else reason = row.checked_at ? 'metadata_pending' : 'verification_pending';
    }
  }
  return { stage, reason, importedAt: row.imported_at, checkedAt: row.checked_at, verifiedAt: row.verified_at,
    metadata: row.checked_at ? { total: row.metadata_total, ready: row.metadata_ready,
      pending: row.metadata_pending, blocked: row.metadata_blocked } : null };
}

/** Bulk projection for at most the existing history page; never starts work. */
export async function addRecoveryProgress(db, request, receipts) {
  if (!receipts.length) return receipts;
  const { rows } = await db.query(`SELECT r.*,s.run_id AS current_run_id,s.phase AS ingestion_phase,
    l.is_active AS library_enabled,l.archived_at,ms.is_active AS source_enabled,
    ${RECOVERY_SOURCE_MATCH_SQL} AS source_matches,
    (NULLIF(btrim(ms.url),'') IS NOT NULL AND NULLIF(btrim(ms.api_key),'') IS NOT NULL) AS configured,
    (${INGESTION_OWNER_ACTIVE_SQL}) AS owner_active, (${INGESTION_FOREIGN_MARKERS_SQL}) AS foreign_markers,
    (${SOURCE_CONTENT_COOLING_SQL}) AS source_cooling,
    (s.backfill_run_id=s.run_id AND s.backfill_completed_at IS NOT NULL) AS handoff_complete,
    (EXISTS (SELECT 1 FROM media_source_capture_state c WHERE c.library_id=l.id
      AND (c.rejected_count>0 OR c.uncapturable_count>0 OR c.omitted_count>0))
      OR EXISTS (SELECT 1 FROM media_source_observations o WHERE o.library_id=l.id)) AS identity_unresolved
    FROM ingestion_recovery_progress r JOIN libraries l ON l.id=r.library_id
    LEFT JOIN media_server ms ON ms.id=l.media_server_id
    LEFT JOIN library_ingestion_state s ON s.library_id=l.id
    WHERE r.audit_id=ANY($1::integer[]) AND r.library_id=$2`, [receipts.map(row => row.auditId), request.libraryId]);
  const byAudit = new Map(rows.map(row => [row.audit_id, row]));
  return receipts.map(receipt => ({ ...receipt, progress: projectRecoveryProgress(byAudit.get(receipt.auditId), receipt) }));
}

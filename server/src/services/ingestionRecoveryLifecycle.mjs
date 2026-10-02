/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { RECOVERY_SOURCE_FINGERPRINT_SQL, RECOVERY_SOURCE_MATCH_SQL } from './ingestionRecoverySource.mjs';

/** Caller holds the ingestion owner and the confirmation transaction. */
export async function startRecoveryProgress(db, { auditId, libraryId, requestId, runId }) {
  await db.query(`UPDATE ingestion_recovery_progress SET stage='superseded',reason='new_recovery'
    WHERE library_id=$1 AND stage NOT IN ('completed','superseded')`, [libraryId]);
  const result = await db.query(`INSERT INTO ingestion_recovery_progress
    (audit_id,library_id,request_id,run_id,stage,source_id,source_fingerprint,source_external_id,source_media_type)
    SELECT $1,l.id,$3,$4,'requested',ms.id,${RECOVERY_SOURCE_FINGERPRINT_SQL},l.external_id,l.media_type
    FROM libraries l JOIN media_server ms ON ms.id=l.media_server_id WHERE l.id=$2`,
  [auditId, libraryId, requestId, runId]);
  if (result.rowCount !== 1) throw new Error('ingestion_recovery_source_unavailable');
}

/** Preserve intent across owned retries; a later ordinary scan is different work. */
export async function advanceRecoveryAttempt(db, libraryId, previous, runId) {
  if (!previous?.run_id) return;
  await db.query(`UPDATE ingestion_recovery_progress r SET
    stage=CASE WHEN $4 OR NOT ${RECOVERY_SOURCE_MATCH_SQL} THEN 'superseded' ELSE 'importing' END,
    reason=CASE WHEN $4 THEN 'new_scan' WHEN NOT ${RECOVERY_SOURCE_MATCH_SQL} THEN 'source_changed' ELSE NULL END,
    run_id=CASE WHEN $4 THEN r.run_id ELSE $3::uuid END
    FROM libraries l JOIN media_server ms ON ms.id=l.media_server_id
    WHERE r.library_id=$1 AND r.run_id=$2 AND l.id=r.library_id AND r.stage NOT IN ('completed','superseded')`,
  [libraryId, previous.run_id, runId, previous.phase === 'complete']);
}

/** Same transaction as successful owned scan completion and inventory reconciliation. */
export async function recordRecoveryImport(db, libraryId, runId) {
  await db.query(`UPDATE ingestion_recovery_progress SET stage='backfilling',imported_at=clock_timestamp(),
    next_check_at=clock_timestamp() WHERE library_id=$1 AND run_id=$2 AND stage='importing'`, [libraryId, runId]);
}

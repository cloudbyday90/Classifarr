/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError } from '../utils/appError.mjs';
import { projectReconciliationReceipt } from './legacyIngestionReceipt.mjs';
import { startRecoveryProgress } from './ingestionRecoveryLifecycle.mjs';
import { MEDIA_SYNC_OWNER_LOCK } from './mediaSyncLockKeys.mjs';
import { LEGACY_MARKER_LIMIT, LEGACY_RECONCILIATION_ACTION } from './legacyIngestionContract.mjs';

export async function readLegacyIngestion(db, libraryId, lock = false) {
  const { rows: [library] } = await db.query(`SELECT l.id,l.name,l.media_type,l.media_server_id,l.is_active,l.archived_at,
    l.xmin::text AS revision FROM libraries l WHERE l.id=$1${lock ? ' FOR UPDATE' : ''}`, [libraryId]); // sql-interpolation: fixed boolean lock clause
  if (!library) throw new NotFoundError('Library not found');
  const { rows: [source] } = await db.query(`SELECT xmin::text AS revision,type,is_active,
    (length(btrim(url))>0 AND length(btrim(api_key))>0) AS configured FROM media_server
    WHERE id=$1${lock ? ' FOR SHARE' : ''}`, [library.media_server_id]); // sql-interpolation: fixed boolean lock clause
  const { rows: [ownership] } = await db.query(`SELECT run_id,phase,sync_status_id,capture_generation,xmin::text AS revision
    FROM library_ingestion_state WHERE library_id=$1${lock ? ' FOR UPDATE' : ''}`, [libraryId]); // sql-interpolation: fixed boolean lock clause
  const { rows: syncs } = await db.query(`SELECT id,status,items_processed,items_total,started_at,xmin::text AS revision
    FROM media_server_sync_status WHERE library_id=$1 AND status IN ('pending','running')
    ORDER BY id LIMIT $2${lock ? ' FOR UPDATE' : ''}`, [libraryId, LEGACY_MARKER_LIMIT + 1]); // sql-interpolation: fixed boolean lock clause
  const { rows: [capture] } = await db.query(`SELECT generation,source,observed_count,xmin::text AS revision
    FROM media_source_capture_state WHERE library_id=$1 AND phase='collecting'${lock ? ' FOR UPDATE' : ''}`, [libraryId]); // sql-interpolation: fixed boolean lock clause
  const { rows: [owner] } = await db.query(`SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype='advisory'
    AND classid=$1::oid AND objid=$2::oid AND objsubid=2 AND granted AND pid<>pg_backend_pid()
    AND database=(SELECT oid FROM pg_database WHERE datname=current_database())) AS active`, [MEDIA_SYNC_OWNER_LOCK, libraryId]);
  return { library, source: source ?? null, ownership: ownership ?? null, syncs, capture: capture ?? null, activeOwner: owner.active };
}

export async function readReconciliationReceipt(db, request) {
  const { rows: [row] } = await db.query(`SELECT id,created_at,user_id,metadata FROM audit_log
    WHERE action='library_ingestion_reconciled' AND metadata->>'requestId'=$1`, [request.requestId]);
  if (!row) return null;
  return projectReconciliationReceipt(row, request);
}

export async function reconcileLegacyIngestion(db, snapshot, request) {
  const syncIds = snapshot.syncs.map(row => row.id);
  const runId = randomUUID();
  const replay = request.resume ? 'scheduled' : 'waiting_for_enable';
  const statuses = await db.query(`UPDATE media_server_sync_status SET status='failed',completed_at=clock_timestamp(),
    error_message='Legacy import reconciled after administrator-confirmed worker shutdown; full replay required'
    WHERE library_id=$1 AND id=ANY($2::integer[]) AND status IN ('pending','running')`, [request.libraryId, syncIds]);
  if (statuses.rowCount !== syncIds.length) throw new ConflictError('Import markers changed; refresh the preview');
  if (snapshot.capture) {
    const capture = await db.query(`UPDATE media_source_capture_state SET phase='failed',completed_at=clock_timestamp()
      WHERE library_id=$1 AND generation=$2 AND source=$3 AND phase='collecting'`,
    [request.libraryId, snapshot.capture.generation, snapshot.capture.source]);
    if (capture.rowCount !== 1) throw new ConflictError('Source capture changed; refresh the preview');
  }
  await db.query(`INSERT INTO library_ingestion_state(library_id,run_id,phase,retry_after)
    VALUES ($1,$2,'retry_wait',clock_timestamp()) ON CONFLICT(library_id) DO UPDATE
    SET run_id=EXCLUDED.run_id,phase='retry_wait',retry_after=EXCLUDED.retry_after,
      sync_status_id=NULL,capture_generation=NULL,attempt_count=1,pages_processed=0,
      items_processed=0,items_total=NULL,updated_at=clock_timestamp()`, [request.libraryId, runId]);
  // Audit failure must roll back reconciliation; the general logger is deliberately not used.
  const { rows: [audit] } = await db.query(`INSERT INTO audit_log(user_id,action,metadata)
    VALUES ($1,$2,$3::jsonb) RETURNING id,created_at`, [request.actorId, LEGACY_RECONCILIATION_ACTION, JSON.stringify({
    version: 2, requestId: request.requestId, libraryId: request.libraryId, revision: request.revision,
    syncIds, capture: snapshot.capture ? { generation: snapshot.capture.generation, source: snapshot.capture.source } : null,
    runId, workersStopped: true, verification: 'administrator_attestation', replay, resume: request.resume,
  })]);
  await startRecoveryProgress(db, { auditId: audit.id, libraryId: request.libraryId, requestId: request.requestId, runId });
  return { auditId: audit.id, confirmedAt: audit.created_at, requestId: request.requestId,
    libraryId: request.libraryId, status: 'reconciled', replay };
}

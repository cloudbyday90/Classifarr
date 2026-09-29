/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ConflictError, NotFoundError, ServiceUnavailableError } from '../utils/appError.mjs';
import { LEGACY_RETRY_LIMIT, LEGACY_RETRY_ACTION } from './legacyEnrichmentRetryContract.mjs';

export async function readLegacyRetries(db, libraryId, lock = false) {
  // Lock retry/source rows before library state, matching the normal result guard.
  const { rows: candidates } = await db.query(`SELECT erq.id,erq.media_item_id,erq.enrichment_type,
    erq.attempts,erq.max_attempts,erq.xmin::text AS retry_revision,
    msi.xmin::text AS source_revision,msi.title,msi.year,msi.media_type
    FROM enrichment_retry_queue erq JOIN media_server_items msi ON msi.id=erq.media_item_id
    WHERE msi.library_id=$1 AND msi.media_type IN ('movie','tv')
      AND erq.enrichment_type IN ('omdb','web_search','tavily') AND erq.status='processing'
      AND erq.attempts >= 0 AND erq.max_attempts >= 1
      AND erq.claim_token IS NULL AND erq.claim_until IS NULL
    ORDER BY erq.id LIMIT $2${lock ? ' FOR UPDATE OF erq,msi' : ''}`,
  [libraryId, LEGACY_RETRY_LIMIT + 1]); // sql-interpolation: fixed boolean lock clause
  const { rows: [library] } = await db.query(`SELECT id,name,media_type,is_active,archived_at,
    xmin::text AS revision FROM libraries WHERE id=$1${lock ? ' FOR SHARE' : ''}`, [libraryId]); // sql-interpolation: fixed boolean lock clause
  if (!library) throw new NotFoundError('Library not found');
  return { library, rows: candidates.slice(0, LEGACY_RETRY_LIMIT), hasMore: candidates.length > LEGACY_RETRY_LIMIT };
}

export async function readLegacyRetryReceipt(db, request) {
  const { rows: [row] } = await db.query(`SELECT id,user_id,created_at,metadata FROM audit_log
    WHERE action='legacy_enrichment_retries_recovered' AND metadata->>'requestId'=$1`, [request.requestId]);
  if (!row) return null;
  const data = row.metadata;
  if (data?.version !== 1 || data.workersStopped !== true || data.verification !== 'administrator_attestation' ||
      !/^"[a-f0-9]{64}"$/.test(data.revision ?? '') || !Array.isArray(data.records) ||
      !data.records.length || data.records.length > LEGACY_RETRY_LIMIT || data.records.some(record =>
        !Number.isInteger(record.id) || record.id <= 0 || !['pending', 'failed'].includes(record.status))) {
    throw new ServiceUnavailableError('The recovery receipt could not be verified');
  }
  if (row.user_id !== request.actorId || data.libraryId !== request.libraryId ||
      (request.revision && data.revision !== request.revision)) {
    throw new ConflictError('This confirmation ID belongs to another review');
  }
  return { auditId: row.id, confirmedAt: row.created_at, requestId: request.requestId,
    libraryId: request.libraryId, queued: data.records.filter(record => record.status === 'pending').length,
    exhausted: data.records.filter(record => record.status === 'failed').length };
}

export async function recoverLegacyRetries(db, snapshot, request, itemState) {
  const ids = snapshot.rows.map(row => row.id);
  const { rows, rowCount } = await db.query(`UPDATE enrichment_retry_queue
    SET status=CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
      completed_at=CASE WHEN attempts >= max_attempts THEN clock_timestamp() ELSE NULL END
    WHERE id=ANY($1::integer[]) AND status='processing' AND claim_token IS NULL AND claim_until IS NULL
    RETURNING id,media_item_id,status,attempts,max_attempts`, [ids]);
  if (rowCount !== ids.length) throw new ConflictError('Retry records changed. Refresh the review.');
  for (const id of [...new Set(rows.map(row => row.media_item_id))].sort((a, b) => a - b)) {
    await itemState.syncItemState(id, db);
  }
  await db.query(`INSERT INTO audit_log(user_id,action,metadata) VALUES ($1,$2,$3::jsonb)`,
  [request.actorId, LEGACY_RETRY_ACTION, JSON.stringify({ version: 1, requestId: request.requestId,
    libraryId: request.libraryId, revision: request.revision, workersStopped: true,
    verification: 'administrator_attestation', records: rows.map(row => ({ id: row.id,
      itemId: row.media_item_id, status: row.status, attempts: row.attempts, maxAttempts: row.max_attempts })) })]);
  return readLegacyRetryReceipt(db, request);
}

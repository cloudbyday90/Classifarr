/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { NotFoundError } from '../utils/appError.mjs';
import { projectReconciliationReceipt } from './legacyIngestionReceipt.mjs';
import { addRecoveryProgress } from './ingestionRecoveryProgress.mjs';
import { projectCompatibilityReceipt } from './ingestionCompatibilityReceipt.mjs';

export const INGESTION_HISTORY_LIMIT = 20;

/** Caller supplies a read-only transaction and a revalidated administrator. */
export async function readIngestionRecoveryHistory(db, request) {
  const library = await db.query('SELECT id FROM libraries WHERE id=$1', [request.libraryId]);
  if (!library.rows.length) throw new NotFoundError('Library not found');
  const { rows } = await db.query(`SELECT id,created_at,user_id,action,metadata FROM audit_log
    WHERE ((action='library_ingestion_reconciled' AND user_id=$1)
      OR (action='library_ingestion_compatibility_recovered' AND user_id IS NULL AND metadata->>'moreBatches'='false'))
      AND metadata->>'libraryId'=$2
    ORDER BY id DESC LIMIT $3`, [request.actorId, String(request.libraryId), INGESTION_HISTORY_LIMIT + 1]);
  const receipts = rows.slice(0, INGESTION_HISTORY_LIMIT).map(row =>
    row.action === 'library_ingestion_compatibility_recovered'
      ? projectCompatibilityReceipt(row, request) : projectReconciliationReceipt(row, request));
  return { receipts: await addRecoveryProgress(db, request, receipts),
    limit: INGESTION_HISTORY_LIMIT, hasMore: rows.length > INGESTION_HISTORY_LIMIT };
}

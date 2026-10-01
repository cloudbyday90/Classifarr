/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ConflictError, ServiceUnavailableError } from '../utils/appError.mjs';
import { reviewPreviewId } from './mediaIdentityReviewContract.mjs';

/** Shared allowlist projection: a recorded handoff is not import completion. */
export function projectReconciliationReceipt(row, request) {
  const metadata = row.metadata;
  const resume = metadata?.version === 2 && metadata.resume === true;
  const replay = resume ? 'scheduled' : 'waiting_for_enable';
  let requestId;
  try { requestId = reviewPreviewId(metadata?.requestId); }
  catch { throw new ServiceUnavailableError('The reconciliation receipt could not be verified'); }
  if (![1, 2].includes(metadata?.version) || metadata.workersStopped !== true ||
      (metadata.version === 1 && (metadata.resume !== undefined || metadata.replay !== 'waiting_for_enable')) ||
      (metadata.version === 2 && (typeof metadata.resume !== 'boolean' || metadata.replay !== replay)) ||
      metadata.verification !== 'administrator_attestation' ||
      !/^"[a-f0-9]{64}"$/.test(metadata.revision ?? '') || !Array.isArray(metadata.syncIds)) {
    throw new ServiceUnavailableError('The reconciliation receipt could not be verified');
  }
  if (row.user_id !== request.actorId || metadata.libraryId !== request.libraryId ||
      (request.requestId && requestId !== request.requestId) ||
      (request.revision && metadata.revision !== request.revision) ||
      (request.resume !== undefined && request.resume !== resume)) {
    throw new ConflictError('This confirmation ID belongs to another review', { code: 'ingestion_request_mismatch' });
  }
  return { auditId: row.id, confirmedAt: row.created_at, requestId,
    libraryId: request.libraryId, status: 'reconciled', replay };
}

/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ServiceUnavailableError } from '../utils/appError.mjs';
import { reviewPreviewId } from './mediaIdentityReviewContract.mjs';

/** Automatic recovery is installation evidence, never another user's manual receipt. */
export function projectCompatibilityReceipt(row, request) {
  const m = row.metadata;
  let requestId;
  try { requestId = reviewPreviewId(m?.requestId); }
  catch { throw new ServiceUnavailableError('Automatic recovery receipt could not be verified'); }
  if (row.user_id !== null || m?.version !== 1 || m.libraryId !== request.libraryId ||
      m.verification !== 'compatibility_protocol_1' || m.moreBatches !== false ||
      !Array.isArray(m.syncIds) || m.syncIds.length > 100 ||
      !m.syncIds.every(id => Number.isSafeInteger(id) && id > 0)) {
    throw new ServiceUnavailableError('Automatic recovery receipt could not be verified');
  }
  return { auditId: row.id, confirmedAt: row.created_at, requestId, libraryId: m.libraryId,
    status: 'reconciled', replay: 'scheduled', automatic: true };
}

/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { AppError, ValidationError } from '../utils/appError.mjs';
import { reviewBody, reviewInteger, reviewPreviewId } from './mediaIdentityReviewContract.mjs';

export const LEGACY_MARKER_LIMIT = 100;
export const LEGACY_RECONCILIATION_ACTION = 'library_ingestion_reconciled';

export function reconciliationRequest(actorId, libraryId, body, ifMatch) {
  reviewBody(body, ['requestId', 'workersStopped']);
  if (body.workersStopped !== true) throw new ValidationError('Confirm that older instances and external capture scripts have stopped');
  if (ifMatch === undefined) throw new AppError('Refresh the preview before confirming', 428, { code: 'ingestion_preview_required' });
  if (typeof ifMatch !== 'string' || !/^"[a-f0-9]{64}"$/.test(ifMatch)) throw new ValidationError('An exact ingestion preview revision is required');
  return { actorId: reviewInteger(actorId), libraryId: reviewInteger(libraryId),
    requestId: reviewPreviewId(body.requestId), revision: ifMatch };
}

export function projectLegacyIngestion(snapshot, actorId) {
  const { library, ownership, capture, syncs, activeOwner } = snapshot;
  const foreign = syncs.some(row => row.id !== ownership?.sync_status_id) || Boolean(capture &&
    (capture.generation !== ownership?.capture_generation || capture.source !== 'media_sync'));
  const reason = !['movie', 'tv'].includes(library.media_type) || !library.media_server_id ? 'unsupported_library'
    : activeOwner ? 'active_owner'
      : syncs.length > LEGACY_MARKER_LIMIT ? 'too_many_markers'
        : !foreign ? 'not_needed'
          : library.is_active ? 'disable_library' : 'confirmation_required';
  const revision = `"${createHash('sha256').update(JSON.stringify([1, actorId, snapshot])).digest('hex')}"`;
  return { version: 1, revision, reason, canReconcile: reason === 'confirmation_required',
    library: { id: library.id, name: library.name, enabled: library.is_active },
    truncated: syncs.length > LEGACY_MARKER_LIMIT,
    syncs: syncs.slice(0, LEGACY_MARKER_LIMIT).map(row => ({ id: row.id, status: row.status,
      processed: row.items_processed, total: row.items_total, startedAt: row.started_at })),
    capture: capture ? { generation: capture.generation, source: capture.source, observed: capture.observed_count } : null };
}

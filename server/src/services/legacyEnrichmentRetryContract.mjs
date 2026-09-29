/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { AppError, ValidationError } from '../utils/appError.mjs';
import { reviewBody, reviewInteger, reviewPreviewId } from './mediaIdentityReviewContract.mjs';

export const LEGACY_RETRY_LIMIT = 50;
export const LEGACY_RETRY_ACTION = 'legacy_enrichment_retries_recovered';

export function legacyRetryRequest(actorId, libraryId, body, revision) {
  reviewBody(body, ['requestId', 'workersStopped']);
  if (body.workersStopped !== true) throw new ValidationError('Confirm that older instances and external writers have stopped');
  if (revision === undefined) throw new AppError('Refresh the review before confirming', 428);
  if (typeof revision !== 'string' || !/^"[a-f0-9]{64}"$/.test(revision)) throw new ValidationError('An exact review revision is required');
  return { actorId: reviewInteger(actorId), libraryId: reviewInteger(libraryId), requestId: reviewPreviewId(body.requestId), revision };
}

export function projectLegacyRetries(snapshot, actorId) {
  const { library, rows, hasMore } = snapshot;
  const reason = !['movie', 'tv'].includes(library.media_type) ? 'unsupported_library'
    : library.archived_at ? 'library_archived' : rows.length ? 'confirmation_required' : 'not_needed';
  return {
    revision: `"${createHash('sha256').update(JSON.stringify([1, actorId, snapshot])).digest('hex')}"`,
    canRecover: reason === 'confirmation_required', reason, hasMore,
    library: { id: library.id, name: library.name, enabled: library.is_active },
    items: rows.map(row => ({ id: row.id, itemId: row.media_item_id, title: row.title, year: row.year,
      mediaType: row.media_type, provider: row.enrichment_type, attempts: row.attempts, maxAttempts: row.max_attempts,
      outcome: row.attempts >= row.max_attempts ? 'failed' : 'pending' })),
  };
}

/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { AppError, ConflictError } from '../utils/appError.mjs';
import { requireReviewActor } from './mediaIdentityReviewRepository.mjs';
import { reviewInteger, reviewPreviewId } from './mediaIdentityReviewContract.mjs';
import { EnrichmentItemStateService } from './enrichmentItemStateService.mjs';
import { legacyRetryRequest, projectLegacyRetries } from './legacyEnrichmentRetryContract.mjs';
import { readLegacyRetries, readLegacyRetryReceipt, recoverLegacyRetries } from './legacyEnrichmentRetryRepository.mjs';

export function createLegacyEnrichmentRetryService(database, { itemState = new EnrichmentItemStateService({ db: database }), onRecovered = () => {} } = {}) {
  async function transaction(work, readOnly = false) {
    return database.withTransaction(async db => {
      if (readOnly) await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
      await db.query("SET LOCAL lock_timeout='2s'");
      await db.query("SET LOCAL statement_timeout='5s'");
      await db.query("SET LOCAL idle_in_transaction_session_timeout='10s'");
      await db.query("SET LOCAL transaction_timeout='15s'");
      return work(db);
    });
  }
  return {
    async preview(actorId, libraryId) {
      actorId = reviewInteger(actorId); libraryId = reviewInteger(libraryId);
      return transaction(async db => {
        await requireReviewActor(db, actorId);
        return projectLegacyRetries(await readLegacyRetries(db, libraryId), actorId);
      }, true);
    },
    async receipt(actorId, libraryId, requestId) {
      const request = { actorId: reviewInteger(actorId), libraryId: reviewInteger(libraryId), requestId: reviewPreviewId(requestId) };
      return transaction(async db => {
        await requireReviewActor(db, request.actorId);
        return { receipt: await readLegacyRetryReceipt(db, request) };
      }, true);
    },
    async confirm(actorId, libraryId, body, revision) {
      const request = legacyRetryRequest(actorId, libraryId, body, revision);
      const result = await transaction(async db => {
        await requireReviewActor(db, request.actorId, true);
        const receipt = await readLegacyRetryReceipt(db, request);
        if (receipt) return { receipt, repeated: true };
        const snapshot = await readLegacyRetries(db, request.libraryId, true);
        const preview = projectLegacyRetries(snapshot, request.actorId);
        if (preview.revision !== request.revision) throw new AppError('Retry state changed. Refresh and review again.', 412);
        if (!preview.canRecover) throw new ConflictError('This library has no eligible legacy retries', { code: preview.reason });
        return { receipt: await recoverLegacyRetries(db, snapshot, request, itemState), repeated: false };
      });
      // Queue state is durable. A failed wake-up must not hide the committed receipt.
      if (!result.repeated && result.receipt.queued) {
        try { await onRecovered(); } catch { /* The regular retry schedule remains available. */ }
      }
      return result;
    },
  };
}

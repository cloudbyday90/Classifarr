/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { AppError, ConflictError } from '../utils/appError.mjs';
import { requireReviewActor } from './mediaIdentityReviewRepository.mjs';
import { reviewInteger, reviewPreviewId } from './mediaIdentityReviewContract.mjs';
import { projectLegacyIngestion, reconciliationRequest } from './legacyIngestionContract.mjs';
import { readLegacyIngestion, readReconciliationReceipt, reconcileLegacyIngestion } from './legacyIngestionRepository.mjs';
import { createMediaSyncOwnership } from './mediaSyncOwnership.mjs';
import { mediaSyncDatabase } from './mediaSyncDatabaseScope.mjs';

export function createLegacyIngestionService(database, own = createMediaSyncOwnership({ pool: database.pool })) {
  return {
    async preview(actorId, libraryId) {
      actorId = reviewInteger(actorId); libraryId = reviewInteger(libraryId);
      return database.withTransaction(async db => {
        await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
        await db.query("SET LOCAL statement_timeout='3s'");
        await requireReviewActor(db, actorId);
        return projectLegacyIngestion(await readLegacyIngestion(db, libraryId), actorId);
      });
    },
    async receipt(actorId, libraryId, requestId) {
      const request = { actorId: reviewInteger(actorId), libraryId: reviewInteger(libraryId), requestId: reviewPreviewId(requestId) };
      return database.withTransaction(async db => {
        await db.query("SET LOCAL statement_timeout='3s'");
        await requireReviewActor(db, request.actorId);
        const receipt = await readReconciliationReceipt(db, request);
        return { status: receipt ? 'reconciled' : 'not_observed', receipt };
      });
    },
    async confirm(actorId, libraryId, body, ifMatch) {
      const request = reconciliationRequest(actorId, libraryId, body, ifMatch);
      const result = await own(request.libraryId, () => mediaSyncDatabase.withTransaction(async db => {
        await db.query("SET LOCAL statement_timeout='5s'");
        await db.query("SET LOCAL lock_timeout='500ms'");
        await requireReviewActor(db, request.actorId, true);
        const receipt = await readReconciliationReceipt(db, request);
        if (receipt) return { receipt, repeated: true };
        const snapshot = await readLegacyIngestion(db, request.libraryId, true);
        const preview = projectLegacyIngestion(snapshot, request.actorId);
        if (preview.revision !== request.revision) throw new AppError('Import state changed. Refresh and review again.', 412, { code: 'ingestion_preview_changed' });
        if (request.resume ? !preview.canResume : !preview.canReconcile) {
          throw new ConflictError('This import is not eligible for the requested recovery', {
            code: request.resume ? preview.resumeReason : preview.reason,
          });
        }
        return { receipt: await reconcileLegacyIngestion(db, snapshot, request), repeated: false };
      }));
      if (result?.deferred) throw new ConflictError('An import currently owns the library or ingestion capacity. Try again later.', { code: result.reason });
      return result;
    },
  };
}

/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { AppError, ConflictError } from '../utils/appError.mjs';
import { requireReviewActor } from './mediaIdentityReviewRepository.mjs';
import { reviewInteger, reviewPreviewId } from './mediaIdentityReviewContract.mjs';
import { readLibraryCatalogContext, lockLibraryCatalogSource } from './libraryCatalogContext.mjs';
import { readArchiveLibrary, readArchiveSnapshot, readArchiveReceipt, changeLibraryArchive } from './libraryArchiveRepository.mjs';
import { archiveRequest, projectLibraryArchive } from './libraryArchiveContract.mjs';
import { MEDIA_SYNC_OWNER_LOCK } from './mediaSyncLockKeys.mjs';

export function createLibraryArchiveService(db, resolveService) {
  async function contextFor(libraryId) {
    const library = await readArchiveLibrary(db, libraryId);
    if (library.archived_at) return null;
    if (!library.media_server_id) throw new ConflictError('Only source-linked libraries support catalog archive review');
    return readLibraryCatalogContext(db, resolveService, library.media_server_id);
  }
  return {
    async preview(actorId, libraryId) {
      actorId = reviewInteger(actorId); libraryId = reviewInteger(libraryId);
      await requireReviewActor(db, actorId);
      const context = await contextFor(libraryId);
      return db.withTransaction(async client => {
        await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
        await client.query("SET LOCAL statement_timeout='3s'");
        await requireReviewActor(client, actorId);
        return projectLibraryArchive(await readArchiveSnapshot(client, libraryId), context, actorId);
      });
    },
    async receipt(actorId, libraryId, requestId) {
      const request = { actorId: reviewInteger(actorId), libraryId: reviewInteger(libraryId), requestId: reviewPreviewId(requestId) };
      await requireReviewActor(db, request.actorId);
      return { receipt: await readArchiveReceipt(db, request) };
    },
    async confirm(actorId, libraryId, body, revision) {
      const request = archiveRequest(actorId, libraryId, body, revision);
      await requireReviewActor(db, request.actorId);
      // A committed receipt remains readable even if the provider is now offline.
      const prior = await readArchiveReceipt(db, request);
      if (prior) return { receipt: prior, repeated: true };
      const context = await contextFor(request.libraryId);
      return db.withTransaction(async client => {
        await client.query("SET LOCAL lock_timeout='500ms'");
        await client.query("SET LOCAL statement_timeout='5s'");
        const { rows: [lock] } = await client.query('SELECT pg_try_advisory_xact_lock($1,$2) AS acquired', [MEDIA_SYNC_OWNER_LOCK, request.libraryId]);
        if (!lock.acquired) throw new ConflictError('An import owns this library. Wait and review again.', { code: 'active_owner' });
        await requireReviewActor(client, request.actorId, true);
        const repeated = await readArchiveReceipt(client, request);
        if (repeated) return { receipt: repeated, repeated: true };
        if (context) await lockLibraryCatalogSource(client, context.source);
        const snapshot = await readArchiveSnapshot(client, request.libraryId, true);
        const review = projectLibraryArchive(snapshot, context, request.actorId);
        if (review.revision !== request.revision || review.operation !== request.operation) {
          throw new AppError('Archive review changed. Refresh and review again.', 412);
        }
        if (!review.canConfirm) throw new ConflictError('This library is not ready for the reviewed operation', { code: review.reason });
        return { receipt: await changeLibraryArchive(client, request), repeated: false };
      });
    },
  };
}

/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mediaSyncDatabase as db } from './mediaSyncDatabaseScope.mjs';
import { createLogger } from '../utils/logger.mjs';
import { createMediaSyncSkipSummary } from './mediaSyncSkipSummary.mjs';
import { createMediaSyncRecoveryWorkflow } from './mediaSyncRecoveryWorkflow.mjs';
import { requestInventoryDescriptionRefresh } from './inventoryDescriptionRefreshSignal.mjs';
import { canonicalMediaType } from './mediaIdentityValues.mjs';
const logger = createLogger('mediaSync');

export async function runOwnedMediaSync(sync, libraryId, options, owner) {
  const { LibraryNotFoundError, isLibraryNotFoundError } = sync.errors;
  let { incremental = false } = options;
  const { batchSize = 100 } = options;

  try {
    const libraryResult = await db.query(
      `SELECT l.*, ms.type, ms.url, ms.api_key, ms.is_active AS server_active
       FROM libraries l
       JOIN media_server ms ON l.media_server_id = ms.id
       WHERE l.id = $1`,
      [libraryId],
    );

    if (libraryResult.rows.length === 0) {
      logger.warn('Library not found during sync', { libraryId });
      throw new LibraryNotFoundError(libraryId);
    }

    const library = libraryResult.rows[0];
    if (!canonicalMediaType(library.media_type)) {
      return { success: true, skipped: true, reason: 'unsupported_media_type' };
    }
    if (library.is_active === false || library.server_active === false) {
      return { success: false, deferred: true, reason: 'source_disabled' };
    }
    if (![library.url, library.api_key].every(value => typeof value === 'string' && value.trim())) {
      return { success: false, deferred: true, reason: 'source_unconfigured' };
    }
    const claim = await owner.claim();
    if (claim.reason) {
      if (claim.reason === 'legacy_owner_unknown') logger.warn('Ingestion ownership is unknown; automatic takeover withheld',
        { libraryId, reason: claim.reason, recovery: 'An older or external capture may still be active. Verify that owner has stopped before reconciling its status; age alone is not proof.' },
        { dedupeKey: `ingestion-owner:${libraryId}`, dedupeWindowMs: 86400000 });
      return { success: false, deferred: true, reason: claim.reason };
    }
    if (claim.replay) incremental = false;
    const { type, url, api_key, media_server_id, external_id } = library;

    let syncStatusId, sourceCapture, completed = false;
    const skippedItems = createMediaSyncSkipSummary();
    const identityRecovery = sync.createIdentityRecovery();

    try {
      await db.withTransaction(async () => {
        await owner.assertSource(library);
        const syncStatusResult = await db.query(
          `INSERT INTO media_server_sync_status
           (media_server_id, library_id, sync_type, status, started_at)
           VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
          [media_server_id, libraryId, incremental ? 'incremental' : 'full', 'running'],
        );
        syncStatusId = syncStatusResult.rows[0].id;
        sourceCapture = await sync.sourceObservations.start(media_server_id, libraryId, { incremental });
        await owner.attach(syncStatusId, sourceCapture);
      });
      const service = await sync.getMediaServerService(type);
      const recoveryWorkflow = createMediaSyncRecoveryWorkflow({
        store: sync.sourceObservations, context: sourceCapture, recovery: identityRecovery,
        source: { service, url, apiKey: api_key, libraryKey: String(external_id) },
        persistRecovery: (...args) => sync.persistIdentityRecovery(...args), logger,
        upsert: item => sync.upsertMediaItem(media_server_id, libraryId, item, {
          onSkippedItem: skippedItem => skippedItems.record(skippedItem),
        }),
      });
      let offset = 0;
      let totalItems = 0;
      let reportedTotal = null;
      let processedItems = 0;
      let ignoredItems = 0;
      let hasMore = true;
      const seenItemExternalIds = new Set();

      while (hasMore) {
        owner.signal?.throwIfAborted();
        const items = await service.getLibraryItems(url, api_key, external_id, {
          offset,
          limit: batchSize,
        });

        owner.signal?.throwIfAborted();
        if (!Array.isArray(items)) throw new Error('ingestion_page_invalid');
        await owner.assertSource(library);
        if (items.length === 0) {
          hasMore = false;
          break;
        }

        const supportedItems = items.filter(item => canonicalMediaType(item?.media_type));
        if (supportedItems.some(item => !((typeof item.external_id === 'string' && item.external_id.trim()) ||
          (Number.isSafeInteger(item.external_id) && item.external_id > 0)))) {
          // Without a stable source key, this page cannot prove what pruning may delete.
          throw new Error('ingestion_source_key_invalid');
        }
        const ignoredOnPage = items.length - supportedItems.length;
        ignoredItems += ignoredOnPage;
        processedItems += ignoredOnPage;
        owner.signal?.throwIfAborted();
        if (supportedItems.length > 0 && await sync.sourceObservations.capture(sourceCapture, supportedItems) === false) {
          throw new Error('source_capture_superseded');
        }

        for (const item of supportedItems) {
          if (item?.external_id) {
            seenItemExternalIds.add(String(item.external_id));
          }
          processedItems += await recoveryWorkflow.process(item);
        }

        if (items[0]?.total && items[0].total > 0) {
          totalItems = items[0].total;
          if (Number.isSafeInteger(totalItems) && totalItems <= 2147483647) reportedTotal = totalItems;
        } else {
          totalItems = Math.max(totalItems, processedItems + recoveryWorkflow.pendingCount);
        }

        offset += batchSize;

        await db.query(
          `UPDATE media_server_sync_status
           SET items_total = $1, items_processed = $2
           WHERE id = $3`,
          [totalItems, processedItems, syncStatusId],
        );
        await owner.checkpoint(processedItems, reportedTotal);

        if (items.length < batchSize) {
          hasMore = false;
        }
      }

      const collections = await service.getCollections(url, api_key, external_id);
      if (!Array.isArray(collections)) throw new Error('ingestion_collections_invalid');
      await owner.assertSource(library);
      const seenCollectionExternalIds = new Set();
      for (const collection of collections) {
        if (collection?.external_id) {
          seenCollectionExternalIds.add(String(collection.external_id));
        }
        await sync.upsertCollection(media_server_id, libraryId, collection);
      }

      let prunedItems = 0;
      let prunedCollections = 0;
      processedItems += await recoveryWorkflow.flush();
      await db.withTransaction(async () => {
        owner.signal?.throwIfAborted();
        await owner.assertSource(library);
        // Finalization and deletion commit together only for a still-current capture.
        if (await sync.sourceObservations.finish(sourceCapture) === false) throw new Error('source_capture_superseded');
        if (!incremental) {
          prunedItems = await sync.pruneMissingMediaItems(libraryId, [...seenItemExternalIds]);
          prunedCollections = await sync.pruneMissingCollections(libraryId, [...seenCollectionExternalIds]);
        }
        await sync.reconcileAwaitingDecisions(libraryId);

        await db.query(
          `UPDATE media_server_sync_status
           SET status = $1, completed_at = NOW(), items_total = $2, items_processed = $3
           WHERE id = $4`,
          ['completed', totalItems, processedItems, syncStatusId],
        );
        await owner.finish(true, processedItems);
      });
      completed = true;
      await sync.skipReporter.report({ libraryId, mediaServerId: media_server_id, syncStatusId,
        incremental, sourceType: type }, skippedItems.snapshot());

      logger.info('Library sync completed', {
        libraryId,
        totalItems,
        ignoredItems,
        collectionsCount: collections.length,
        prunedItems,
        prunedCollections,
      });
      requestInventoryDescriptionRefresh();

      return {
        success: true,
        totalItems,
        processedItems,
        ignoredItems,
        collections: collections.length,
        prunedItems,
        prunedCollections,
      };
    } catch (error) {
      if (completed) throw error; // Reporting cannot undo a committed ingestion.
      // A disconnected owner must never finalize through a replacement connection.
      owner.signal?.throwIfAborted();
      if (sourceCapture) {
        try { await sync.sourceObservations.finish(sourceCapture, { failed: true }); }
        catch { logger.warn('Source observation capture finalization unavailable', { libraryId }); }
      }
      if (syncStatusId) await db.query(
        `UPDATE media_server_sync_status
         SET status = $1, error_message = $2, completed_at = NOW()
         WHERE id = $3`,
        ['failed', error.message, syncStatusId],
      );
      await owner.finish(false);
      throw error;
    }
  } catch (error) {
    if (!isLibraryNotFoundError(error)) {
      logger.error('Library sync failed', { libraryId, error: error.message });
    }
    throw error;
  }
}

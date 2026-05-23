import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import * as errorsModule from '../utils/errors.mjs';
import { getMediaServerService as defaultGetMediaServerService } from './mediaServers/index.mjs';
import { mediaSyncLibraryStateService } from './mediaSyncLibraryStateService.mjs';
import { upsertMediaItem as _upsertMediaItem, upsertCollection as _upsertCollection } from './mediaSyncUpsert.mjs';
import { pruneMissingMediaItems as _pruneMissingMediaItems, pruneMissingCollections as _pruneMissingCollections, getSyncStatus as _getSyncStatus, getLibraryItems as _getLibraryItems, syncLibrariesFromMediaServer as _syncLibrariesFromMediaServer } from './mediaSyncQueries.mjs';

const logger = createLogger('mediaSync');

export class MediaSyncService {
  constructor(deps = {}) {
    this.errors = deps.errors || errorsModule;
    this.mediaServerServices = deps.mediaServerServices || {
      getMediaServerService: defaultGetMediaServerService,
    };
    this.mediaSyncLibraryStateService = deps.mediaSyncLibraryStateService || mediaSyncLibraryStateService;
  }

  async syncLibrary(libraryId, options = {}) {
    const { LibraryNotFoundError, isLibraryNotFoundError } = this.errors;
    const { incremental = false, batchSize = 100 } = options;

    try {
      const libraryResult = await db.query(
        `SELECT l.*, ms.type, ms.url, ms.api_key 
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
      const { type, url, api_key, media_server_id, external_id } = library;

      const syncStatusResult = await db.query(
        `INSERT INTO media_server_sync_status 
         (media_server_id, library_id, sync_type, status, started_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id`,
        [media_server_id, libraryId, incremental ? 'incremental' : 'full', 'running'],
      );
      const syncStatusId = syncStatusResult.rows[0].id;

      try {
        const service = await this.getMediaServerService(type);
        let offset = 0;
        let totalItems = 0;
        let processedItems = 0;
        let hasMore = true;
        const seenItemExternalIds = new Set();

        while (hasMore) {
          const items = await service.getLibraryItems(url, api_key, external_id, {
            offset,
            limit: batchSize,
          });

          if (!items || items.length === 0) {
            hasMore = false;
            break;
          }

          for (const item of items) {
            if (item?.external_id) {
              seenItemExternalIds.add(String(item.external_id));
            }
            await this.upsertMediaItem(media_server_id, libraryId, item);
            processedItems += 1;
          }

          if (items[0]?.total && items[0].total > 0) {
            totalItems = items[0].total;
          } else if (totalItems === 0) {
            totalItems = processedItems;
          }

          offset += batchSize;

          await db.query(
            `UPDATE media_server_sync_status 
             SET items_total = $1, items_processed = $2
             WHERE id = $3`,
            [totalItems, processedItems, syncStatusId],
          );

          if (items.length < batchSize) {
            hasMore = false;
          }
        }

        const collections = await service.getCollections(url, api_key, external_id);
        const seenCollectionExternalIds = new Set();
        for (const collection of collections) {
          if (collection?.external_id) {
            seenCollectionExternalIds.add(String(collection.external_id));
          }
          await this.upsertCollection(media_server_id, libraryId, collection);
        }

        let prunedItems = 0;
        let prunedCollections = 0;
        if (!incremental) {
          prunedItems = await this.pruneMissingMediaItems(libraryId, [...seenItemExternalIds]);
          prunedCollections = await this.pruneMissingCollections(libraryId, [...seenCollectionExternalIds]);
        }

        await this.reconcileAwaitingDecisions(libraryId);

        await db.query(
          `UPDATE media_server_sync_status 
           SET status = $1, completed_at = NOW(), items_total = $2, items_processed = $3
           WHERE id = $4`,
          ['completed', totalItems, processedItems, syncStatusId],
        );

        logger.info('Library sync completed', {
          libraryId,
          totalItems,
          collectionsCount: collections.length,
          prunedItems,
          prunedCollections,
        });

        return {
          success: true,
          totalItems,
          processedItems,
          collections: collections.length,
          prunedItems,
          prunedCollections,
        };
      } catch (error) {
        await db.query(
          `UPDATE media_server_sync_status 
           SET status = $1, error_message = $2, completed_at = NOW()
           WHERE id = $3`,
          ['failed', error.message, syncStatusId],
        );
        throw error;
      }
    } catch (error) {
      if (!isLibraryNotFoundError(error)) {
        logger.error('Library sync failed', { libraryId, error: error.message });
      }
      throw error;
    }
  }

  async findExistingMedia(tmdbId, mediaType) {
    return this.mediaSyncLibraryStateService.findExistingMedia(tmdbId, mediaType);
  }

  async getLibraryContext(tmdbId, metadata) {
    return this.mediaSyncLibraryStateService.getLibraryContext(tmdbId, metadata);
  }

  async upsertMediaItem(...args) {
    return _upsertMediaItem(...args);
  }

  async upsertCollection(...args) {
    return _upsertCollection(...args);
  }

  async pruneMissingMediaItems(...args) {
    return _pruneMissingMediaItems(...args);
  }

  async pruneMissingCollections(...args) {
    return _pruneMissingCollections(...args);
  }

  async getSyncStatus(...args) {
    return _getSyncStatus(...args);
  }

  async getLibraryItems(...args) {
    return _getLibraryItems(...args);
  }

  async getMediaServerService(type) {
    const { getMediaServerService } = this.mediaServerServices;
    return getMediaServerService(type);
  }

  async reconcileAwaitingDecisions(libraryId) {
    return this.mediaSyncLibraryStateService.reconcileAwaitingDecisions(libraryId);
  }

  async syncAllLibraries() {
    try {
      logger.info('Starting fresh sync of all libraries from media server');
      const syncedLibraries = await this.syncLibrariesFromMediaServer();

      for (const library of syncedLibraries) {
        await this.syncLibrary(library.id);
      }

      logger.info('Fresh sync completed', { libraryCount: syncedLibraries.length });
    } catch (error) {
      logger.error('Failed to sync all libraries', { error: error.message });
      throw error;
    }
  }

  async syncLibrariesFromMediaServer() {
    return _syncLibrariesFromMediaServer((type) => this.getMediaServerService(type));
  }
}

export const mediaSyncService = new MediaSyncService();

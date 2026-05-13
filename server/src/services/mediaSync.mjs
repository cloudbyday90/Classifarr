/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import * as db from '../config/database.mjs';
import { contentTypeAnalyzer } from './contentTypeAnalyzer.mjs';
import { createLogger } from '../utils/logger.mjs';
import * as errorsModule from '../utils/errors.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import { getMediaServerService as defaultGetMediaServerService } from './mediaServers/index.mjs';
import { mediaSyncLibraryStateService } from './mediaSyncLibraryStateService.mjs';

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

  async upsertMediaItem(mediaServerId, libraryId, item) {
    try {
      const libraryCheck = await db.query('SELECT id FROM libraries WHERE id = $1', [libraryId]);
      if (libraryCheck.rows.length === 0) {
        logger.warn(`Skipping media item - library ${libraryId} no longer exists (likely deleted during re-sync)`, {
          item: item.external_id,
        });
        return;
      }

      const normalizedGenres = normalizeMetadataList(item.genres);
      const normalizedTags = normalizeMetadataList(item.tags);
      const normalizedCollections = normalizeMetadataList(item.collections);

      const analysis = await contentTypeAnalyzer.analyze({
        title: item.title,
        overview: item.metadata?.summary || '',
        genres: normalizedGenres,
        keywords: normalizedTags,
        content_rating: item.content_rating,
        original_language: 'en',
        tmdb_id: item.tmdb_id,
      }, null, true);

      if (analysis.analyzed && analysis.bestMatch) {
        item.metadata = {
          ...(item.metadata || {}),
          content_analysis: {
            type: analysis.bestMatch.type,
            confidence: analysis.bestMatch.confidence,
            detected_at: new Date().toISOString(),
          },
        };
      }

      await db.query(
        `INSERT INTO media_server_items 
         (media_server_id, library_id, external_id, tmdb_id, imdb_id, tvdb_id, 
          title, original_title, year, media_type, genres, tags, collections, 
          studio, content_rating, added_at, metadata, last_synced)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
         ON CONFLICT (media_server_id, external_id)
         DO UPDATE SET
           library_id = EXCLUDED.library_id,
           tmdb_id = EXCLUDED.tmdb_id,
           imdb_id = EXCLUDED.imdb_id,
           tvdb_id = EXCLUDED.tvdb_id,
           title = EXCLUDED.title,
           original_title = EXCLUDED.original_title,
           year = EXCLUDED.year,
           genres = EXCLUDED.genres,
           tags = EXCLUDED.tags,
           collections = EXCLUDED.collections,
           studio = EXCLUDED.studio,
           content_rating = EXCLUDED.content_rating,
           metadata = COALESCE(media_server_items.metadata, '{}')::jsonb || EXCLUDED.metadata::jsonb,
           last_synced = NOW()`,
        [
          mediaServerId,
          libraryId,
          item.external_id,
          item.tmdb_id || null,
          item.imdb_id || null,
          item.tvdb_id || null,
          item.title,
          item.original_title || null,
          item.year || null,
          item.media_type,
          normalizedGenres,
          normalizedTags,
          normalizedCollections,
          item.studio || null,
          item.content_rating || null,
          item.added_at || null,
          JSON.stringify(item.metadata || {}),
        ],
      );
    } catch (error) {
      if (error.code === '23503') {
        logger.warn(`Skipping media item - library ${libraryId} no longer exists (race condition)`, {
          item: item.external_id,
        });
        return;
      }
      logger.error('Error upserting media item', { item: item.external_id, error: error.message });
    }
  }

  async upsertCollection(mediaServerId, libraryId, collection) {
    try {
      const libraryCheck = await db.query('SELECT id FROM libraries WHERE id = $1', [libraryId]);
      if (libraryCheck.rows.length === 0) {
        logger.warn(`Skipping collection - library ${libraryId} no longer exists`, {
          collection: collection.name,
        });
        return;
      }

      await db.query(
        `INSERT INTO media_server_collections 
         (media_server_id, library_id, external_id, name, item_count, last_synced)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (media_server_id, external_id)
         DO UPDATE SET
           name = EXCLUDED.name,
           item_count = EXCLUDED.item_count,
           last_synced = NOW()`,
        [mediaServerId, libraryId, collection.external_id, collection.name, collection.item_count || 0],
      );
    } catch (error) {
      if (error.code === '23503') {
        logger.warn(`Skipping collection - library ${libraryId} no longer exists (race condition)`, {
          collection: collection.name,
        });
        return;
      }
      logger.error('Error upserting collection', { collection: collection.name, error: error.message });
    }
  }

  async pruneMissingMediaItems(libraryId, seenExternalIds = []) {
    try {
      const result = seenExternalIds.length > 0
        ? await db.query(
          `DELETE FROM media_server_items
           WHERE library_id = $1
             AND NOT (external_id = ANY($2::text[]))`,
          [libraryId, seenExternalIds],
        )
        : await db.query(
          `DELETE FROM media_server_items
           WHERE library_id = $1`,
          [libraryId],
        );

      return result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to prune missing media items after full sync', {
        libraryId,
        error: error.message,
      });
      throw error;
    }
  }

  async pruneMissingCollections(libraryId, seenExternalIds = []) {
    try {
      const result = seenExternalIds.length > 0
        ? await db.query(
          `DELETE FROM media_server_collections
           WHERE library_id = $1
             AND NOT (external_id = ANY($2::text[]))`,
          [libraryId, seenExternalIds],
        )
        : await db.query(
          `DELETE FROM media_server_collections
           WHERE library_id = $1`,
          [libraryId],
        );

      return result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to prune missing collections after full sync', {
        libraryId,
        error: error.message,
      });
      throw error;
    }
  }

  async getSyncStatus(libraryId = null) {
    try {
      let query = `
        SELECT ss.*, l.name as library_name, ms.name as media_server_name
        FROM media_server_sync_status ss
        LEFT JOIN libraries l ON ss.library_id = l.id
        LEFT JOIN media_server ms ON ss.media_server_id = ms.id
      `;

      const params = [];
      if (libraryId) {
        query += ' WHERE ss.library_id = $1';
        params.push(libraryId);
      }

      query += ' ORDER BY ss.created_at DESC LIMIT 50';

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error getting sync status', { error: error.message });
      return [];
    }
  }

  async getLibraryItems(libraryId, options = {}) {
    const { LibraryNotFoundError, isLibraryNotFoundError } = this.errors;
    const { limit = 50, offset = 0 } = options;

    try {
      const libraryCheck = await db.query('SELECT id FROM libraries WHERE id = $1', [libraryId]);

      if (libraryCheck.rows.length === 0) {
        logger.warn('Library not found when getting items', { libraryId });
        throw new LibraryNotFoundError(libraryId);
      }

      const result = await db.query(
        `SELECT * FROM media_server_items
         WHERE library_id = $1
         ORDER BY added_at DESC
         LIMIT $2 OFFSET $3`,
        [libraryId, limit, offset],
      );

      const countResult = await db.query(
        'SELECT COUNT(*) FROM media_server_items WHERE library_id = $1',
        [libraryId],
      );

      return {
        items: result.rows,
        total: Number.parseInt(countResult.rows[0].count, 10),
      };
    } catch (error) {
      if (!isLibraryNotFoundError(error)) {
        logger.error('Error getting library items', { libraryId, error: error.message });
      }
      throw error;
    }
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
    try {
      const serverResult = await db.query('SELECT * FROM media_server WHERE is_active = true LIMIT 1');

      if (serverResult.rows.length === 0) {
        throw new Error('No active media server configured');
      }

      const server = serverResult.rows[0];
      const service = await this.getMediaServerService(server.type);
      const libraries = await service.getLibraries(server.url, server.api_key);

      const syncedLibraries = [];
      for (const library of libraries) {
        let arrType = null;
        if (library.media_type === 'movie') {
          arrType = 'radarr';
        } else if (library.media_type === 'tv') {
          arrType = 'sonarr';
        }

        const result = await db.query(
          `INSERT INTO libraries (media_server_id, external_id, name, media_type, arr_type)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (media_server_id, external_id) 
           DO UPDATE SET name = EXCLUDED.name, media_type = EXCLUDED.media_type, arr_type = EXCLUDED.arr_type
           RETURNING *`,
          [server.id, library.external_id, library.name, library.media_type, arrType],
        );

        syncedLibraries.push(result.rows[0]);
      }

      logger.info('Synced libraries from media server', {
        mediaServer: server.type,
        count: syncedLibraries.length,
      });

      return syncedLibraries;
    } catch (error) {
      logger.error('Failed to sync libraries from media server', { error: error.message });
      throw error;
    }
  }
}

export const mediaSyncService = new MediaSyncService();

/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const db = require('../config/database');
const plexService = require('./plex');
const embyService = require('./emby');
const jellyfinService = require('./jellyfin');
const { createLogger } = require('../utils/logger');

const logger = createLogger('mediaSync');

class MediaSyncService {
  /**
   * Sync library content from media server
   * @param {number} libraryId - Library ID to sync
   * @param {object} options - Sync options
   * @returns {Promise<object>} Sync result
   */
  async syncLibrary(libraryId, options = {}) {
    const { incremental = false, batchSize = 100 } = options;

    try {
      // Get library and media server details
      const libraryResult = await db.query(
        `SELECT l.*, ms.type, ms.url, ms.api_key 
         FROM libraries l
         JOIN media_server ms ON l.media_server_id = ms.id
         WHERE l.id = $1`,
        [libraryId]
      );

      if (libraryResult.rows.length === 0) {
        throw new Error(`Library ${libraryId} not found`);
      }

      const library = libraryResult.rows[0];
      const { type, url, api_key, media_server_id, external_id } = library;

      // Create sync status record
      const syncStatusResult = await db.query(
        `INSERT INTO media_server_sync_status 
         (media_server_id, library_id, sync_type, status, started_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id`,
        [media_server_id, libraryId, incremental ? 'incremental' : 'full', 'running']
      );
      const syncStatusId = syncStatusResult.rows[0].id;

      try {
        // Get service based on media server type
        const service = this.getMediaServerService(type);
        
        // Sync items in batches
        let offset = 0;
        let totalItems = 0;
        let processedItems = 0;
        let hasMore = true;

        while (hasMore) {
          const items = await service.getLibraryItems(url, api_key, external_id, {
            offset,
            limit: batchSize
          });

          if (!items || items.length === 0) {
            hasMore = false;
            break;
          }

          // Process batch
          for (const item of items) {
            await this.upsertMediaItem(media_server_id, libraryId, item);
            processedItems++;
          }

          totalItems = items.total || processedItems;
          offset += batchSize;

          // Update progress
          await db.query(
            `UPDATE media_server_sync_status 
             SET items_total = $1, items_processed = $2
             WHERE id = $3`,
            [totalItems, processedItems, syncStatusId]
          );

          if (items.length < batchSize) {
            hasMore = false;
          }
        }

        // Sync collections
        const collections = await service.getCollections(url, api_key, external_id);
        for (const collection of collections) {
          await this.upsertCollection(media_server_id, libraryId, collection);
        }

        // Mark sync as completed
        await db.query(
          `UPDATE media_server_sync_status 
           SET status = $1, completed_at = NOW(), items_total = $2, items_processed = $3
           WHERE id = $4`,
          ['completed', totalItems, processedItems, syncStatusId]
        );

        logger.info(`Library sync completed`, {
          libraryId,
          totalItems,
          collectionsCount: collections.length
        });

        return {
          success: true,
          totalItems,
          processedItems,
          collections: collections.length
        };
      } catch (error) {
        // Mark sync as failed
        await db.query(
          `UPDATE media_server_sync_status 
           SET status = $1, error_message = $2, completed_at = NOW()
           WHERE id = $3`,
          ['failed', error.message, syncStatusId]
        );
        throw error;
      }
    } catch (error) {
      logger.error(`Library sync failed`, { libraryId, error: error.message });
      throw error;
    }
  }

  /**
   * Find existing media in any library by TMDB ID
   * @param {number} tmdbId - TMDB ID
   * @param {string} mediaType - Media type (movie/tv)
   * @returns {Promise<object|null>} Existing media item or null
   */
  async findExistingMedia(tmdbId, mediaType) {
    try {
      const result = await db.query(
        `SELECT msi.*, l.name as library_name, l.id as library_id
         FROM media_server_items msi
         JOIN libraries l ON msi.library_id = l.id
         WHERE msi.tmdb_id = $1 AND msi.media_type = $2
         LIMIT 1`,
        [tmdbId, mediaType]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error(`Error finding existing media`, { tmdbId, error: error.message });
      return null;
    }
  }

  /**
   * Get library context for existing media
   * @param {number} tmdbId - TMDB ID
   * @param {object} metadata - Media metadata
   * @returns {Promise<object|null>} Library context or null
   */
  async getLibraryContext(tmdbId, metadata) {
    const existingItem = await this.findExistingMedia(tmdbId, metadata.media_type);
    
    if (!existingItem) {
      return null;
    }

    return {
      exists: true,
      library_id: existingItem.library_id,
      library_name: existingItem.library_name,
      title: existingItem.title,
      year: existingItem.year,
      added_at: existingItem.added_at,
      collections: existingItem.collections || [],
      tags: existingItem.tags || []
    };
  }

  /**
   * Upsert media item into cache
   * @param {number} mediaServerId - Media server ID
   * @param {number} libraryId - Library ID
   * @param {object} item - Media item
   */
  async upsertMediaItem(mediaServerId, libraryId, item) {
    try {
      await db.query(
        `INSERT INTO media_server_items 
         (media_server_id, library_id, external_id, tmdb_id, imdb_id, tvdb_id, 
          title, original_title, year, media_type, genres, tags, collections, 
          studio, content_rating, added_at, metadata, last_synced)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
         ON CONFLICT (media_server_id, external_id)
         DO UPDATE SET
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
           metadata = EXCLUDED.metadata,
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
          item.genres || [],
          item.tags || [],
          item.collections || [],
          item.studio || null,
          item.content_rating || null,
          item.added_at || null,
          JSON.stringify(item.metadata || {})
        ]
      );
    } catch (error) {
      logger.error(`Error upserting media item`, { item: item.external_id, error: error.message });
    }
  }

  /**
   * Upsert collection into cache
   * @param {number} mediaServerId - Media server ID
   * @param {number} libraryId - Library ID
   * @param {object} collection - Collection data
   */
  async upsertCollection(mediaServerId, libraryId, collection) {
    try {
      await db.query(
        `INSERT INTO media_server_collections 
         (media_server_id, library_id, external_id, name, item_count, last_synced)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (media_server_id, external_id)
         DO UPDATE SET
           name = EXCLUDED.name,
           item_count = EXCLUDED.item_count,
           last_synced = NOW()`,
        [mediaServerId, libraryId, collection.external_id, collection.name, collection.item_count || 0]
      );
    } catch (error) {
      logger.error(`Error upserting collection`, { collection: collection.name, error: error.message });
    }
  }

  /**
   * Get sync status for a library
   * @param {number} libraryId - Library ID
   * @returns {Promise<Array>} Sync status records
   */
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
        query += ` WHERE ss.library_id = $1`;
        params.push(libraryId);
      }
      
      query += ` ORDER BY ss.created_at DESC LIMIT 50`;
      
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error(`Error getting sync status`, { error: error.message });
      return [];
    }
  }

  /**
   * Get synced items for a library
   * @param {number} libraryId - Library ID
   * @param {object} options - Query options
   * @returns {Promise<Array>} Synced items
   */
  async getLibraryItems(libraryId, options = {}) {
    const { limit = 50, offset = 0 } = options;
    
    try {
      const result = await db.query(
        `SELECT * FROM media_server_items
         WHERE library_id = $1
         ORDER BY added_at DESC
         LIMIT $2 OFFSET $3`,
        [libraryId, limit, offset]
      );

      const countResult = await db.query(
        `SELECT COUNT(*) FROM media_server_items WHERE library_id = $1`,
        [libraryId]
      );

      return {
        items: result.rows,
        total: parseInt(countResult.rows[0].count)
      };
    } catch (error) {
      logger.error(`Error getting library items`, { libraryId, error: error.message });
      return { items: [], total: 0 };
    }
  }

  /**
   * Get appropriate media server service
   * @param {string} type - Media server type
   * @returns {object} Service instance
   */
  getMediaServerService(type) {
    switch (type.toLowerCase()) {
      case 'plex':
        return plexService;
      case 'emby':
        return embyService;
      case 'jellyfin':
        return jellyfinService;
      default:
        throw new Error(`Unknown media server type: ${type}`);
    }
  }
}

module.exports = new MediaSyncService();

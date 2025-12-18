const db = require('../config/database');
const plexService = require('./plex');
const embyService = require('./emby');
const jellyfinService = require('./jellyfin');
const { createLogger } = require('../utils/logger');

const logger = createLogger('media-sync');

class MediaSyncService {
  /**
   * Sync a specific library from the media server
   * @param {number} libraryId - Library ID to sync
   * @param {object} options - Sync options (incremental, full, limit)
   */
  async syncLibrary(libraryId, options = {}) {
    const { incremental = true, limit = 100 } = options;

    try {
      // Get library and media server info
      const libraryResult = await db.query(
        `SELECT l.*, m.type, m.url, m.api_key 
         FROM libraries l
         JOIN media_server m ON l.media_server_id = m.id
         WHERE l.id = $1`,
        [libraryId]
      );

      if (libraryResult.rows.length === 0) {
        throw new Error(`Library ${libraryId} not found`);
      }

      const library = libraryResult.rows[0];
      const mediaServer = {
        id: library.media_server_id,
        type: library.type,
        url: library.url,
        api_key: library.api_key,
      };

      // Create sync status record
      const syncStatusResult = await db.query(
        `INSERT INTO media_server_sync_status 
         (media_server_id, library_id, sync_type, status, started_at)
         VALUES ($1, $2, $3, 'in_progress', NOW())
         RETURNING id`,
        [mediaServer.id, libraryId, incremental ? 'incremental' : 'full']
      );
      const syncStatusId = syncStatusResult.rows[0].id;

      logger.info(`Starting ${incremental ? 'incremental' : 'full'} sync for library ${libraryId}`);

      let service;
      switch (mediaServer.type) {
        case 'plex':
          service = plexService;
          break;
        case 'emby':
          service = embyService;
          break;
        case 'jellyfin':
          service = jellyfinService;
          break;
        default:
          throw new Error(`Unknown media server type: ${mediaServer.type}`);
      }

      let offset = 0;
      let totalProcessed = 0;
      let totalAdded = 0;
      let totalUpdated = 0;
      let hasMore = true;

      while (hasMore) {
        const items = await service.getLibraryItems(
          mediaServer.url,
          mediaServer.api_key,
          library.external_id,
          { offset, limit }
        );

        if (!items || items.length === 0) {
          hasMore = false;
          break;
        }

        for (const item of items) {
          try {
            const { added, updated } = await this.upsertMediaItem(
              mediaServer.id,
              libraryId,
              item
            );
            
            if (added) totalAdded++;
            if (updated) totalUpdated++;
            totalProcessed++;
          } catch (error) {
            logger.error(`Error syncing item: ${error.message}`, { item: item.title });
          }
        }

        // Update sync progress
        await db.query(
          `UPDATE media_server_sync_status 
           SET items_processed = $1, items_added = $2, items_updated = $3
           WHERE id = $4`,
          [totalProcessed, totalAdded, totalUpdated, syncStatusId]
        );

        offset += limit;
        
        if (items.length < limit) {
          hasMore = false;
        }
      }

      // Sync collections
      try {
        const collections = await service.getCollections(
          mediaServer.url,
          mediaServer.api_key,
          library.external_id
        );
        
        if (collections && collections.length > 0) {
          for (const collection of collections) {
            await this.upsertCollection(mediaServer.id, libraryId, collection);
          }
        }
      } catch (error) {
        logger.warn(`Collection sync failed: ${error.message}`);
      }

      // Mark sync as completed
      await db.query(
        `UPDATE media_server_sync_status 
         SET status = 'completed', completed_at = NOW(), 
             items_total = $1
         WHERE id = $2`,
        [totalProcessed, syncStatusId]
      );

      logger.info(`Sync completed for library ${libraryId}: ${totalAdded} added, ${totalUpdated} updated`);

      return {
        success: true,
        syncStatusId,
        totalProcessed,
        totalAdded,
        totalUpdated,
      };
    } catch (error) {
      logger.error(`Sync failed for library ${libraryId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sync all active libraries
   */
  async syncAllLibraries() {
    const librariesResult = await db.query(
      'SELECT id FROM libraries WHERE is_active = true'
    );

    const results = [];
    for (const library of librariesResult.rows) {
      try {
        const result = await this.syncLibrary(library.id);
        results.push({ libraryId: library.id, ...result });
      } catch (error) {
        results.push({ 
          libraryId: library.id, 
          success: false, 
          error: error.message 
        });
      }
    }

    return results;
  }

  /**
   * Upsert a media item from the media server
   */
  async upsertMediaItem(mediaServerId, libraryId, item) {
    const result = await db.query(
      `INSERT INTO media_server_items (
        media_server_id, library_id, external_id, tmdb_id, imdb_id, tvdb_id,
        title, original_title, year, media_type, genres, tags, collections,
        studio, content_rating, added_at, metadata, last_synced
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
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
        last_synced = NOW()
      RETURNING (xmax = 0) AS inserted`,
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
        item.metadata || {},
      ]
    );

    return {
      added: result.rows[0].inserted,
      updated: !result.rows[0].inserted,
    };
  }

  /**
   * Upsert a collection from the media server
   */
  async upsertCollection(mediaServerId, libraryId, collection) {
    await db.query(
      `INSERT INTO media_server_collections (
        media_server_id, library_id, external_id, name, description,
        item_count, poster_url, metadata, last_synced
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (media_server_id, external_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        item_count = EXCLUDED.item_count,
        poster_url = EXCLUDED.poster_url,
        metadata = EXCLUDED.metadata,
        last_synced = NOW()`,
      [
        mediaServerId,
        libraryId,
        collection.external_id,
        collection.name,
        collection.description || null,
        collection.item_count || 0,
        collection.poster_url || null,
        collection.metadata || {},
      ]
    );
  }

  /**
   * Find existing media by TMDB ID - prevents duplicates
   */
  async findExistingMedia(tmdbId, mediaType) {
    const result = await db.query(
      `SELECT msi.*, l.name as library_name, l.id as library_id
       FROM media_server_items msi
       JOIN libraries l ON msi.library_id = l.id
       WHERE msi.tmdb_id = $1 AND msi.media_type = $2
       LIMIT 1`,
      [tmdbId, mediaType]
    );

    return result.rows[0] || null;
  }

  /**
   * Get library context for AI classification
   * Returns existing item, matching collections, and library stats
   */
  async getLibraryContext(tmdbId, metadata) {
    const existingItem = await this.findExistingMedia(tmdbId, metadata.media_type);

    // Get matching collections based on metadata
    const collections = await this.findMatchingCollections(metadata);

    // Get library stats
    const statsResult = await db.query(
      `SELECT 
        l.id, l.name, l.media_type,
        COUNT(msi.id) as item_count,
        COUNT(DISTINCT msi.studio) as studio_count,
        array_agg(DISTINCT unnest(msi.genres)) FILTER (WHERE msi.genres IS NOT NULL) as common_genres
       FROM libraries l
       LEFT JOIN media_server_items msi ON l.id = msi.library_id
       WHERE l.media_type = $1 AND l.is_active = true
       GROUP BY l.id, l.name, l.media_type`,
      [metadata.media_type]
    );

    return {
      existingItem,
      matchingCollections: collections,
      libraryStats: statsResult.rows,
    };
  }

  /**
   * Find collections that match the given metadata
   */
  async findMatchingCollections(metadata) {
    if (!metadata.keywords || metadata.keywords.length === 0) {
      return [];
    }

    // Search for collections by keywords
    const result = await db.query(
      `SELECT msc.*, l.name as library_name
       FROM media_server_collections msc
       JOIN libraries l ON msc.library_id = l.id
       WHERE msc.name ILIKE ANY($1)
       LIMIT 10`,
      [metadata.keywords.map(k => `%${k}%`)]
    );

    return result.rows;
  }

  /**
   * Get sync status for a library or all libraries
   */
  async getSyncStatus(libraryId = null) {
    let query;
    let params;

    if (libraryId) {
      query = `
        SELECT ss.*, l.name as library_name, m.name as server_name
        FROM media_server_sync_status ss
        LEFT JOIN libraries l ON ss.library_id = l.id
        LEFT JOIN media_server m ON ss.media_server_id = m.id
        WHERE ss.library_id = $1
        ORDER BY ss.started_at DESC
        LIMIT 10
      `;
      params = [libraryId];
    } else {
      query = `
        SELECT ss.*, l.name as library_name, m.name as server_name
        FROM media_server_sync_status ss
        LEFT JOIN libraries l ON ss.library_id = l.id
        LEFT JOIN media_server m ON ss.media_server_id = m.id
        ORDER BY ss.started_at DESC
        LIMIT 50
      `;
      params = [];
    }

    const result = await db.query(query, params);
    return result.rows;
  }
}

module.exports = new MediaSyncService();

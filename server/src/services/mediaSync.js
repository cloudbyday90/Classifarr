const db = require('../config/database');
const plexService = require('./plex');
const embyService = require('./emby');
const jellyfinService = require('./jellyfin');

class MediaSyncService {
  /**
   * Get service for media server type
   */
  getServiceForServer(type) {
    switch (type) {
      case 'plex':
        return plexService;
      case 'emby':
        return embyService;
      case 'jellyfin':
        return jellyfinService;
      default:
        throw new Error(`Unsupported media server type: ${type}`);
    }
  }

  /**
   * Get library by ID
   */
  async getLibrary(libraryId) {
    const result = await db.query(
      'SELECT * FROM libraries WHERE id = $1',
      [libraryId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Library not found: ${libraryId}`);
    }
    
    return result.rows[0];
  }

  /**
   * Get media server by ID
   */
  async getMediaServer(serverId) {
    const result = await db.query(
      'SELECT * FROM media_server WHERE id = $1',
      [serverId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Media server not found: ${serverId}`);
    }
    
    return result.rows[0];
  }

  /**
   * Create sync status record
   */
  async createSyncStatus(libraryId, syncType) {
    const library = await this.getLibrary(libraryId);
    
    const result = await db.query(
      `INSERT INTO media_server_sync_status 
       (media_server_id, library_id, sync_type, status, started_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [library.media_server_id, libraryId, syncType, 'pending']
    );
    
    return result.rows[0].id;
  }

  /**
   * Update sync status
   */
  async updateSyncStatus(syncId, updates) {
    // Allowlist of valid update fields
    const validFields = [
      'status', 'items_total', 'items_processed', 'items_added', 
      'items_updated', 'items_removed', 'error_message', 'completed_at'
    ];
    
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    for (const [key, value] of Object.entries(updates)) {
      // Only allow valid fields to prevent SQL injection
      if (validFields.includes(key)) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }
    
    if (fields.length === 0) {
      return; // Nothing to update
    }
    
    values.push(syncId);
    
    await db.query(
      `UPDATE media_server_sync_status SET ${fields.join(', ')} WHERE id = $${paramCount}`,
      values
    );
  }

  /**
   * Upsert media item
   */
  async upsertMediaItem(serverId, libraryId, item) {
    const result = await db.query(
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
         media_type = EXCLUDED.media_type,
         genres = EXCLUDED.genres,
         tags = EXCLUDED.tags,
         collections = EXCLUDED.collections,
         studio = EXCLUDED.studio,
         content_rating = EXCLUDED.content_rating,
         added_at = EXCLUDED.added_at,
         metadata = EXCLUDED.metadata,
         last_synced = NOW()
       RETURNING (xmax = 0) AS inserted`,
      [
        serverId,
        libraryId,
        item.externalId,
        item.tmdbId,
        item.imdbId,
        item.tvdbId,
        item.title,
        item.originalTitle,
        item.year,
        item.mediaType,
        item.genres,
        item.tags,
        item.collections,
        item.studio,
        item.contentRating,
        item.addedAt,
        item.metadata ? JSON.stringify(item.metadata) : null
      ]
    );
    
    return {
      inserted: result.rows[0].inserted,
      updated: !result.rows[0].inserted
    };
  }

  /**
   * Upsert collection
   */
  async upsertCollection(serverId, libraryId, collection) {
    await db.query(
      `INSERT INTO media_server_collections 
       (media_server_id, library_id, external_id, name, item_count, poster_url, last_synced)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (media_server_id, external_id)
       DO UPDATE SET
         name = EXCLUDED.name,
         item_count = EXCLUDED.item_count,
         poster_url = EXCLUDED.poster_url,
         last_synced = NOW()`,
      [serverId, libraryId, collection.id, collection.name, collection.itemCount, collection.thumb]
    );
  }

  /**
   * Full sync of a library's contents
   */
  async syncLibrary(libraryId, options = {}) {
    const { fullSync = false } = options;
    
    // Create sync status record
    const syncId = await this.createSyncStatus(libraryId, fullSync ? 'full' : 'incremental');
    
    try {
      const library = await this.getLibrary(libraryId);
      const server = await this.getMediaServer(library.media_server_id);
      const service = this.getServiceForServer(server.type);
      
      // Get total count first
      const { totalCount } = await service.getLibraryItems(
        server.url,
        server.api_key,
        library.external_id,
        { limit: 1 }
      );
      
      await this.updateSyncStatus(syncId, { items_total: totalCount, status: 'running' });
      
      // Paginate through all items
      const batchSize = 100;
      let offset = 0;
      let itemsProcessed = 0;
      let itemsAdded = 0;
      let itemsUpdated = 0;
      
      while (offset < totalCount) {
        const { items } = await service.getLibraryItems(
          server.url,
          server.api_key,
          library.external_id,
          { offset, limit: batchSize }
        );
        
        for (const item of items) {
          const result = await this.upsertMediaItem(server.id, libraryId, item);
          itemsProcessed++;
          if (result.inserted) itemsAdded++;
          if (result.updated) itemsUpdated++;
        }
        
        await this.updateSyncStatus(syncId, {
          items_processed: itemsProcessed,
          items_added: itemsAdded,
          items_updated: itemsUpdated
        });
        
        offset += batchSize;
      }
      
      await this.updateSyncStatus(syncId, {
        status: 'completed',
        completed_at: new Date()
      });
      
      return { success: true, itemsProcessed, itemsAdded, itemsUpdated };
    } catch (error) {
      await this.updateSyncStatus(syncId, {
        status: 'failed',
        error_message: error.message
      });
      throw error;
    }
  }

  /**
   * Sync collections for a library
   */
  async syncCollections(libraryId) {
    const syncId = await this.createSyncStatus(libraryId, 'collections');
    
    try {
      const library = await this.getLibrary(libraryId);
      const server = await this.getMediaServer(library.media_server_id);
      const service = this.getServiceForServer(server.type);
      
      await this.updateSyncStatus(syncId, { status: 'running' });
      
      const collections = await service.getCollections(
        server.url,
        server.api_key,
        library.external_id
      );
      
      for (const collection of collections) {
        await this.upsertCollection(server.id, libraryId, collection);
      }
      
      await this.updateSyncStatus(syncId, {
        status: 'completed',
        items_processed: collections.length,
        completed_at: new Date()
      });
      
      return { success: true, count: collections.length };
    } catch (error) {
      await this.updateSyncStatus(syncId, {
        status: 'failed',
        error_message: error.message
      });
      throw error;
    }
  }

  /**
   * Check if a title exists in any library
   */
  async findExistingMedia(tmdbId, mediaType) {
    const result = await db.query(
      `SELECT msi.*, l.name as library_name
       FROM media_server_items msi
       JOIN libraries l ON msi.library_id = l.id
       WHERE msi.tmdb_id = $1 AND msi.media_type = $2`,
      [tmdbId, mediaType]
    );
    
    return result.rows;
  }

  /**
   * Get library context for AI classification
   */
  async getLibraryContext(tmdbId, metadata) {
    const context = {
      existingItem: null,
      matchingCollections: [],
      libraryStats: [],
      relatedContent: []
    };
    
    // Check if this exact title exists
    const existing = await this.findExistingMedia(tmdbId, metadata.media_type);
    if (existing.length > 0) {
      context.existingItem = existing[0];
    }
    
    // Find collections that might match (by keyword in name)
    if (metadata.keywords && metadata.keywords.length > 0) {
      // Escape SQL LIKE wildcards in keywords
      const escapeLikePattern = (str) => {
        return str.replace(/[%_]/g, '\\$&');
      };
      
      const keywordPatterns = metadata.keywords
        .slice(0, 10) // Limit to 10 keywords for performance
        .map(k => `%${escapeLikePattern(k.toLowerCase())}%`);
      
      if (keywordPatterns.length > 0) {
        const potentialCollections = await db.query(
          `SELECT DISTINCT msc.name, l.name as library_name, l.id as library_id, msc.item_count
           FROM media_server_collections msc
           JOIN libraries l ON msc.library_id = l.id
           WHERE LOWER(msc.name) LIKE ANY($1::text[])
           LIMIT 10`,
          [keywordPatterns]
        );
        
        context.matchingCollections = potentialCollections.rows;
      }
    }
    
    // Get genre distribution per library
    if (metadata.genres && metadata.genres.length > 0) {
      const genreStats = await db.query(
        `SELECT l.id, l.name,
                COUNT(*) FILTER (WHERE $1 = ANY(msi.genres)) as matching_genres,
                COUNT(*) as total_items
         FROM libraries l
         LEFT JOIN media_server_items msi ON l.id = msi.library_id
         WHERE l.media_type = $2
         GROUP BY l.id, l.name
         HAVING COUNT(*) > 0
         ORDER BY matching_genres DESC`,
        [metadata.genres[0], metadata.media_type]
      );
      
      context.libraryStats = genreStats.rows;
    }
    
    return context;
  }
}

module.exports = new MediaSyncService();

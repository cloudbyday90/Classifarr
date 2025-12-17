const express = require('express');
const db = require('../config/database');
const plexService = require('../services/plex');
const embyService = require('../services/emby');
const jellyfinService = require('../services/jellyfin');
const mediaSyncService = require('../services/mediaSync');

const router = express.Router();

/**
 * @swagger
 * /api/media-server:
 *   get:
 *     summary: Get configured media server
 *     responses:
 *       200:
 *         description: Media server configuration
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM media_server WHERE is_active = true LIMIT 1');
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/media-server:
 *   post:
 *     summary: Configure media server
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - name
 *               - url
 *               - api_key
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [plex, emby, jellyfin]
 *               name:
 *                 type: string
 *               url:
 *                 type: string
 *               api_key:
 *                 type: string
 */
router.post('/', async (req, res) => {
  try {
    const { type, name, url, api_key } = req.body;

    // Deactivate existing servers
    await db.query('UPDATE media_server SET is_active = false');

    // Insert new server
    const result = await db.query(
      `INSERT INTO media_server (type, name, url, api_key, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [type, name, url, api_key]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/media-server/test:
 *   post:
 *     summary: Test media server connection
 */
router.post('/test', async (req, res) => {
  try {
    const { type, url, api_key } = req.body;

    let result;
    switch (type) {
      case 'plex':
        result = await plexService.testConnection(url, api_key);
        break;
      case 'emby':
        result = await embyService.testConnection(url, api_key);
        break;
      case 'jellyfin':
        result = await jellyfinService.testConnection(url, api_key);
        break;
      default:
        return res.status(400).json({ error: 'Invalid media server type' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/media-server/sync:
 *   post:
 *     summary: Sync libraries from media server
 */
router.post('/sync', async (req, res) => {
  try {
    const serverResult = await db.query('SELECT * FROM media_server WHERE is_active = true LIMIT 1');
    
    if (serverResult.rows.length === 0) {
      return res.status(404).json({ error: 'No active media server configured' });
    }

    const server = serverResult.rows[0];
    let libraries;

    switch (server.type) {
      case 'plex':
        libraries = await plexService.getLibraries(server.url, server.api_key);
        break;
      case 'emby':
        libraries = await embyService.getLibraries(server.url, server.api_key);
        break;
      case 'jellyfin':
        libraries = await jellyfinService.getLibraries(server.url, server.api_key);
        break;
      default:
        return res.status(400).json({ error: 'Invalid media server type' });
    }

    // Insert or update libraries
    const insertedLibraries = [];
    for (const lib of libraries) {
      const result = await db.query(
        `INSERT INTO libraries (media_server_id, external_id, name, media_type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (media_server_id, external_id) 
         DO UPDATE SET name = $3, updated_at = NOW()
         RETURNING *`,
        [server.id, lib.external_id, lib.name, lib.media_type]
      );
      insertedLibraries.push(result.rows[0]);
    }

    // Update last sync time
    await db.query(
      'UPDATE media_server SET last_sync = NOW() WHERE id = $1',
      [server.id]
    );

    res.json({
      success: true,
      libraries: insertedLibraries,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all items in a library (paginated)
 */
router.get('/items/:libraryId', async (req, res) => {
  try {
    const { libraryId } = req.params;
    const { offset = 0, limit = 50 } = req.query;
    
    const result = await db.query(
      `SELECT * FROM media_server_items 
       WHERE library_id = $1 
       ORDER BY added_at DESC 
       LIMIT $2 OFFSET $3`,
      [libraryId, limit, offset]
    );
    
    const countResult = await db.query(
      'SELECT COUNT(*) FROM media_server_items WHERE library_id = $1',
      [libraryId]
    );
    
    res.json({
      items: result.rows,
      total: parseInt(countResult.rows[0].count),
      offset: parseInt(offset),
      limit: parseInt(limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Search items in a library
 */
router.get('/items/:libraryId/search', async (req, res) => {
  try {
    const { libraryId } = req.params;
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const result = await db.query(
      `SELECT * FROM media_server_items 
       WHERE library_id = $1 AND (
         title ILIKE $2 OR 
         original_title ILIKE $2
       )
       ORDER BY added_at DESC 
       LIMIT 50`,
      [libraryId, `%${q}%`]
    );
    
    res.json({ items: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get collections in a library
 */
router.get('/collections/:libraryId', async (req, res) => {
  try {
    const { libraryId } = req.params;
    
    const result = await db.query(
      `SELECT * FROM media_server_collections 
       WHERE library_id = $1 
       ORDER BY name`,
      [libraryId]
    );
    
    res.json({ collections: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get items in a collection
 */
router.get('/collections/:collectionId/items', async (req, res) => {
  try {
    const { collectionId } = req.params;
    
    // Get collection info
    const collectionResult = await db.query(
      'SELECT * FROM media_server_collections WHERE id = $1',
      [collectionId]
    );
    
    if (collectionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }
    
    const collection = collectionResult.rows[0];
    
    // Get items that belong to this collection
    const itemsResult = await db.query(
      `SELECT * FROM media_server_items 
       WHERE library_id = $1 AND $2 = ANY(collections)
       ORDER BY title`,
      [collection.library_id, collection.name]
    );
    
    res.json({
      collection: collection,
      items: itemsResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Trigger library sync
 */
router.post('/sync/:libraryId', async (req, res) => {
  try {
    const { libraryId } = req.params;
    const { fullSync = true } = req.body;
    
    // Start sync in background (don't wait for completion)
    mediaSyncService.syncLibrary(parseInt(libraryId), { fullSync })
      .catch(err => console.error('Library sync failed:', err));
    
    res.json({
      success: true,
      message: 'Library sync started'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Sync all libraries
 */
router.post('/sync/all', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id FROM libraries WHERE is_active = true'
    );
    
    const libraryIds = result.rows.map(r => r.id);
    
    // Start syncs in background
    for (const libraryId of libraryIds) {
      mediaSyncService.syncLibrary(libraryId, { fullSync: false })
        .catch(err => console.error(`Library ${libraryId} sync failed:`, err));
    }
    
    res.json({
      success: true,
      message: `Sync started for ${libraryIds.length} libraries`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get sync status
 */
router.get('/sync/status', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const result = await db.query(
      `SELECT mss.*, l.name as library_name
       FROM media_server_sync_status mss
       LEFT JOIN libraries l ON mss.library_id = l.id
       ORDER BY mss.created_at DESC
       LIMIT $1`,
      [limit]
    );
    
    res.json({ syncs: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get specific sync status
 */
router.get('/sync/status/:syncId', async (req, res) => {
  try {
    const { syncId } = req.params;
    
    const result = await db.query(
      `SELECT mss.*, l.name as library_name
       FROM media_server_sync_status mss
       LEFT JOIN libraries l ON mss.library_id = l.id
       WHERE mss.id = $1`,
      [syncId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sync not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Check if media exists
 */
router.get('/lookup/:tmdbId', async (req, res) => {
  try {
    const { tmdbId } = req.params;
    const { mediaType = 'movie' } = req.query;
    
    const existing = await mediaSyncService.findExistingMedia(
      parseInt(tmdbId),
      mediaType
    );
    
    res.json({
      exists: existing.length > 0,
      items: existing
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get AI context for classification
 */
router.get('/context/:tmdbId', async (req, res) => {
  try {
    const { tmdbId } = req.params;
    const { mediaType = 'movie', genres = '', keywords = '' } = req.query;
    
    const metadata = {
      media_type: mediaType,
      genres: genres ? genres.split(',') : [],
      keywords: keywords ? keywords.split(',') : []
    };
    
    const context = await mediaSyncService.getLibraryContext(
      parseInt(tmdbId),
      metadata
    );
    
    res.json(context);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

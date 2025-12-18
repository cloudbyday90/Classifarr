const express = require('express');
const db = require('../config/database');
const plexService = require('../services/plex');
const embyService = require('../services/emby');
const jellyfinService = require('../services/jellyfin');
const { maskToken, isMaskedToken } = require('../utils/tokenMasking');

const router = express.Router();

/**
 * @swagger
 * /api/media-server:
 *   get:
 *     summary: Get configured media server (with masked API key)
 *     responses:
 *       200:
 *         description: Media server configuration
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM media_server WHERE is_active = true LIMIT 1');
    if (result.rows[0] && result.rows[0].api_key) {
      result.rows[0].api_key = maskToken(result.rows[0].api_key);
    }
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

    // Get existing config to preserve API key if masked value is sent
    const existingResult = await db.query('SELECT api_key FROM media_server WHERE is_active = true LIMIT 1');
    const existingApiKey = existingResult.rows[0]?.api_key;
    
    // Use existing API key if the provided one is masked
    const finalApiKey = (api_key && !isMaskedToken(api_key)) ? api_key : existingApiKey;

    if (!finalApiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    // Deactivate existing servers
    await db.query('UPDATE media_server SET is_active = false');

    // Insert new server
    const result = await db.query(
      `INSERT INTO media_server (type, name, url, api_key, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [type, name, url, finalApiKey]
    );

    // Mask API key in response
    if (result.rows[0].api_key) {
      result.rows[0].api_key = maskToken(result.rows[0].api_key);
    }

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
 * @swagger
 * /api/media-server/items/:libraryId:
 *   get:
 *     summary: Get media items from a synced library
 */
router.get('/items/:libraryId', async (req, res) => {
  try {
    const { libraryId } = req.params;
    const { page = 1, limit = 50, search } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT * FROM media_server_items
      WHERE library_id = $1
    `;
    const params = [libraryId];

    if (search) {
      query += ` AND (title ILIKE $${params.length + 1} OR original_title ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY added_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/media-server/collections/:libraryId:
 *   get:
 *     summary: Get collections from a synced library
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

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/media-server/sync/:libraryId:
 *   post:
 *     summary: Sync a specific library's content
 */
router.post('/sync/:libraryId', async (req, res) => {
  try {
    const { libraryId } = req.params;
    const { incremental = true, limit = 100 } = req.body;

    const mediaSyncService = require('../services/mediaSync');
    const result = await mediaSyncService.syncLibrary(parseInt(libraryId), { 
      incremental, 
      limit 
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/media-server/sync/all:
 *   post:
 *     summary: Sync all active libraries
 */
router.post('/sync/all', async (req, res) => {
  try {
    const mediaSyncService = require('../services/mediaSync');
    const results = await mediaSyncService.syncAllLibraries();

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/media-server/sync/status:
 *   get:
 *     summary: Get sync status for libraries
 */
router.get('/sync/status', async (req, res) => {
  try {
    const { libraryId } = req.query;
    
    const mediaSyncService = require('../services/mediaSync');
    const status = await mediaSyncService.getSyncStatus(
      libraryId ? parseInt(libraryId) : null
    );

    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/media-server/lookup/:tmdbId:
 *   get:
 *     summary: Lookup media by TMDB ID in media server
 */
router.get('/lookup/:tmdbId', async (req, res) => {
  try {
    const { tmdbId } = req.params;
    const { mediaType = 'movie' } = req.query;

    const mediaSyncService = require('../services/mediaSync');
    const existingMedia = await mediaSyncService.findExistingMedia(
      parseInt(tmdbId),
      mediaType
    );

    res.json(existingMedia || { found: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/media-server/context/:tmdbId:
 *   get:
 *     summary: Get library context for a media item
 */
router.get('/context/:tmdbId', async (req, res) => {
  try {
    const { tmdbId } = req.params;
    const metadata = req.query;

    const mediaSyncService = require('../services/mediaSync');
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

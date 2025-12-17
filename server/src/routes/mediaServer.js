const express = require('express');
const db = require('../config/database');
const plexService = require('../services/plex');
const embyService = require('../services/emby');
const jellyfinService = require('../services/jellyfin');

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

    if (result.success) {
      // Try to fetch library count for additional details
      let libraryCount = 0;
      try {
        let libraries;
        switch (type) {
          case 'plex':
            libraries = await plexService.getLibraries(url, api_key);
            break;
          case 'emby':
            libraries = await embyService.getLibraries(url, api_key);
            break;
          case 'jellyfin':
            libraries = await jellyfinService.getLibraries(url, api_key);
            break;
        }
        libraryCount = libraries?.length || 0;
      } catch (libError) {
        // Ignore library fetch errors - basic connection succeeded
        console.log('Could not fetch library details:', libError.message);
      }

      const serverTypeNames = {
        plex: 'Plex',
        emby: 'Emby',
        jellyfin: 'Jellyfin'
      };

      res.json({
        success: true,
        details: {
          serverName: serverTypeNames[type],
          version: result.data?.version || result.data?.MediaContainer?.version || 'Unknown',
          status: 'Running',
          additionalInfo: {
            'Libraries': libraryCount,
            'Platform': result.data?.platform || result.data?.MediaContainer?.platform || 'Unknown'
          }
        }
      });
    } else {
      const troubleshootingMap = {
        plex: [
          'Ensure Plex Media Server is running',
          `Verify the URL is correct (${url})`,
          'Verify the Plex token is correct',
          'Check remote access settings if connecting remotely',
          'Try accessing the URL directly in a browser'
        ],
        emby: [
          'Ensure Emby Server is running',
          `Verify the URL is correct (${url})`,
          'Ensure the API key is valid',
          'Check if firewall is blocking the connection'
        ],
        jellyfin: [
          'Ensure Jellyfin Server is running',
          `Verify the URL is correct (${url})`,
          'Ensure the API key is valid',
          'Check if firewall is blocking the connection'
        ]
      };

      res.json({
        success: false,
        error: {
          message: result.error,
          code: result.code || 'CONNECTION_ERROR',
          troubleshooting: troubleshootingMap[type] || ['Check that the media server is running and accessible']
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        troubleshooting: [
          'Check your network connection',
          'Verify the media server is accessible from this server'
        ]
      }
    });
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

module.exports = router;

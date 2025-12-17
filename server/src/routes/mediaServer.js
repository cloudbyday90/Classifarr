const express = require('express');
const router = express.Router();
const plexService = require('../services/plex');
const embyService = require('../services/emby');
const jellyfinService = require('../services/jellyfin');

/**
 * @openapi
 * /api/media-server:
 *   get:
 *     summary: Get current media server configuration
 *     description: Retrieves the currently configured media server settings
 *     tags: [Media Server]
 *     responses:
 *       200:
 *         description: Media server configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 type:
 *                   type: string
 *                   enum: [plex, emby, jellyfin]
 *                 host:
 *                   type: string
 *                 port:
 *                   type: number
 */
router.get('/', async (req, res) => {
  try {
    // TODO: Fetch from database
    res.json({
      type: null,
      host: null,
      port: null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/media-server:
 *   post:
 *     summary: Save media server configuration
 *     description: Saves the media server configuration to the database
 *     tags: [Media Server]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - host
 *               - port
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [plex, emby, jellyfin]
 *               host:
 *                 type: string
 *               port:
 *                 type: number
 *               token:
 *                 type: string
 *               apiKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: Configuration saved successfully
 */
router.post('/', async (req, res) => {
  try {
    const { type, host, port, token, apiKey } = req.body;
    
    if (!type || !host || !port) {
      return res.status(400).json({ error: 'Missing required fields: type, host, port' });
    }

    // TODO: Save to database
    res.json({
      success: true,
      message: 'Media server configuration saved',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/media-server/test:
 *   post:
 *     summary: Test media server connection
 *     description: Tests the connection to the specified media server
 *     tags: [Media Server]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - host
 *               - port
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [plex, emby, jellyfin]
 *               host:
 *                 type: string
 *               port:
 *                 type: number
 *               token:
 *                 type: string
 *               apiKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: Connection test result
 */
router.post('/test', async (req, res) => {
  try {
    const { type, host, port, token, apiKey } = req.body;
    
    if (!type || !host || !port) {
      return res.status(400).json({ error: 'Missing required fields: type, host, port' });
    }

    let result;
    switch (type) {
      case 'plex':
        result = await plexService.testConnection(host, port, token);
        break;
      case 'emby':
        result = await embyService.testConnection(host, port, apiKey);
        break;
      case 'jellyfin':
        result = await jellyfinService.testConnection(host, port, apiKey);
        break;
      default:
        return res.status(400).json({ error: 'Invalid media server type' });
    }

    res.json({
      success: result,
      message: result ? 'Connection successful' : 'Connection failed',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @openapi
 * /api/media-server/sync:
 *   post:
 *     summary: Sync media server libraries
 *     description: Retrieves and syncs all libraries from the configured media server
 *     tags: [Media Server]
 *     responses:
 *       200:
 *         description: Libraries synced successfully
 */
router.post('/sync', async (req, res) => {
  try {
    // TODO: Get config from database
    const config = req.body;
    const { type, host, port, token, apiKey } = config;

    if (!type || !host || !port) {
      return res.status(400).json({ error: 'Media server not configured' });
    }

    let libraries;
    switch (type) {
      case 'plex':
        libraries = await plexService.getLibraries(host, port, token);
        break;
      case 'emby':
        libraries = await embyService.getLibraries(host, port, apiKey);
        break;
      case 'jellyfin':
        libraries = await jellyfinService.getLibraries(host, port, apiKey);
        break;
      default:
        return res.status(400).json({ error: 'Invalid media server type' });
    }

    // TODO: Save libraries to database
    res.json({
      success: true,
      libraries,
      count: libraries.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

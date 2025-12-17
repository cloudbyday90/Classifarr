const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const plexService = require('../services/plex');
const embyService = require('../services/emby');
const jellyfinService = require('../services/jellyfin');

/**
 * Get all media servers
 */
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM media_server ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get media server by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM media_server WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Media server not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Create media server
 */
router.post('/', async (req, res) => {
  try {
    const { name, type, url, api_key, username, password, enabled } = req.body;

    const result = await query(`
      INSERT INTO media_server (name, type, url, api_key, username, password, enabled)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [name, type, url, api_key, username, password, enabled !== false]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update media server
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, type, url, api_key, username, password, enabled } = req.body;

    const result = await query(`
      UPDATE media_server 
      SET name = $1, type = $2, url = $3, api_key = $4, username = $5, password = $6, enabled = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [name, type, url, api_key, username, password, enabled, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Media server not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Delete media server
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM media_server WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Media server not found' });
    }
    res.json({ message: 'Media server deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Test connection to media server
 */
router.post('/:id/test', async (req, res) => {
  try {
    const result = await query('SELECT * FROM media_server WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Media server not found' });
    }

    const server = result.rows[0];
    let testResult;

    switch (server.type) {
      case 'plex':
        testResult = await plexService.testConnection(server.url, server.api_key);
        break;
      case 'emby':
        testResult = await embyService.testConnection(server.url, server.api_key);
        break;
      case 'jellyfin':
        testResult = await jellyfinService.testConnection(server.url, server.api_key);
        break;
      default:
        return res.status(400).json({ error: 'Unknown server type' });
    }

    res.json(testResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Sync libraries from media server
 */
router.post('/:id/sync', async (req, res) => {
  try {
    const result = await query('SELECT * FROM media_server WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Media server not found' });
    }

    const server = result.rows[0];
    let libraries;

    switch (server.type) {
      case 'plex':
        libraries = await plexService.syncLibraries(server.id, server.url, server.api_key);
        break;
      case 'emby':
        libraries = await embyService.syncLibraries(server.id, server.url, server.api_key);
        break;
      case 'jellyfin':
        libraries = await jellyfinService.syncLibraries(server.id, server.url, server.api_key);
        break;
      default:
        return res.status(400).json({ error: 'Unknown server type' });
    }

    // Save libraries to database
    for (const lib of libraries) {
      await query(`
        INSERT INTO libraries (media_server_id, name, library_key, path, media_type)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [server.id, lib.title, lib.key, lib.location, lib.type]);
    }

    // Update last sync time
    await query('UPDATE media_server SET last_sync = CURRENT_TIMESTAMP WHERE id = $1', [server.id]);

    res.json({ 
      message: 'Libraries synced successfully',
      count: libraries.length,
      libraries 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

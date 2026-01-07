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
  const client = await db.pool.connect();
  try {
    const { type, name, url, api_key } = req.body;

    await client.query('BEGIN');

    // Get existing config to preserve API key if masked value is sent
    const existingResult = await client.query('SELECT api_key FROM media_server WHERE is_active = true LIMIT 1');
    const existingApiKey = existingResult.rows[0]?.api_key;

    // Use existing API key if the provided one is masked
    const finalApiKey = (api_key && !isMaskedToken(api_key)) ? api_key : existingApiKey;

    if (!finalApiKey) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'API key is required' });
    }

    // Check if we have an existing active media server
    const activeServerResult = await client.query('SELECT id FROM media_server WHERE is_active = true LIMIT 1');

    let result;
    if (activeServerResult.rows.length > 0) {
      // UPDATE existing server to preserve ID (fixes issue #74)
      result = await client.query(
        `UPDATE media_server 
         SET type = $1, name = $2, url = $3, api_key = $4, updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [type, name, url, finalApiKey, activeServerResult.rows[0].id]
      );
    } else {
      // No active server exists, INSERT new one
      result = await client.query(
        `INSERT INTO media_server (type, name, url, api_key, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING *`,
        [type, name, url, finalApiKey]
      );
    }

    await client.query('COMMIT');

    // Mask API key in response
    if (result.rows[0].api_key) {
      result.rows[0].api_key = maskToken(result.rows[0].api_key);
    }

    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    // Don't log the error object directly if it contains sensitive data
    console.error('Failed to save media server config:', error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
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

    // If the api_key is masked, get the real one from the database
    let testApiKey = api_key;
    if (isMaskedToken(api_key)) {
      const existingResult = await db.query('SELECT api_key FROM media_server WHERE is_active = true LIMIT 1');
      testApiKey = existingResult.rows[0]?.api_key;
      if (!testApiKey) {
        return res.status(400).json({ error: 'No saved API key found. Please enter the API key manually.' });
      }
    }

    let result;
    switch (type) {
      case 'plex':
        result = await plexService.testConnection(url, testApiKey);
        break;
      case 'emby':
        result = await embyService.testConnection(url, testApiKey);
        break;
      case 'jellyfin':
        result = await jellyfinService.testConnection(url, testApiKey);
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
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const serverResult = await client.query('SELECT * FROM media_server WHERE is_active = true LIMIT 1');

    if (serverResult.rows.length === 0) {
      await client.query('ROLLBACK');
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
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid media server type' });
    }

    // Clear existing libraries and all related data for this media server before inserting new ones
    // This handles the case where library external IDs change after a media server database rebuild
    // Must delete from child tables first due to foreign key constraints

    // Get library IDs that will be deleted
    const libraryIdsResult = await client.query(
      'SELECT id FROM libraries WHERE media_server_id = $1',
      [server.id]
    );
    const libraryIds = libraryIdsResult.rows.map(r => r.id);

    if (libraryIds.length > 0) {
      // Delete from all tables that reference libraries
      await client.query(
        'DELETE FROM media_server_sync_status WHERE library_id = ANY($1)',
        [libraryIds]
      );
      await client.query(
        'DELETE FROM media_server_items WHERE library_id = ANY($1)',
        [libraryIds]
      );
      await client.query(
        'DELETE FROM media_server_collections WHERE library_id = ANY($1)',
        [libraryIds]
      );
      await client.query(
        'DELETE FROM library_labels WHERE library_id = ANY($1)',
        [libraryIds]
      );
      await client.query(
        'DELETE FROM library_pattern_suggestions WHERE library_id = ANY($1)',
        [libraryIds]
      );
      await client.query(
        'DELETE FROM scheduled_tasks WHERE library_id = ANY($1)',
        [libraryIds]
      );

      // Clear pending queue tasks - they reference old library IDs that no longer exist
      // This prevents tasks from failing repeatedly after library IDs change
      const clearedTasks = await client.query(
        `DELETE FROM task_queue WHERE status IN ('pending', 'processing') RETURNING id`
      );
      if (clearedTasks.rowCount > 0) {
        console.log(`Cleared ${clearedTasks.rowCount} pending queue tasks referencing old libraries`);
      }
      // Now delete the libraries
      await client.query(
        'DELETE FROM libraries WHERE media_server_id = $1',
        [server.id]
      );

      console.log(`Cleared ${libraryIds.length} existing libraries and related data before sync`);
    }

    // Insert libraries fresh
    const insertedLibraries = [];
    for (const lib of libraries) {
      let arrType = null;
      if (lib.media_type === 'movie') {
        arrType = 'radarr';
      } else if (lib.media_type === 'tv') {
        arrType = 'sonarr';
      }

      const result = await client.query(
        `INSERT INTO libraries (media_server_id, external_id, name, media_type, arr_type)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [server.id, lib.external_id, lib.name, lib.media_type, arrType]
      );
      insertedLibraries.push(result.rows[0]);
    }

    // Update last sync time
    await client.query(
      'UPDATE media_server SET last_sync = NOW() WHERE id = $1',
      [server.id]
    );

    await client.query('COMMIT');

    // Auto-sync content for each library in the background
    const mediaSyncService = require('../services/mediaSync');
    for (const library of insertedLibraries) {
      // Run sync in background (don't await)
      mediaSyncService.syncLibrary(library.id, { incremental: false, batchSize: 100 })
        .then(result => {
          console.log(`Auto-sync completed for library ${library.name}: ${result.itemsImported || 0} items`);
        })
        .catch(err => {
          console.error(`Auto-sync failed for library ${library.name}:`, err.message);
        });
    }

    res.json({
      success: true,
      libraries: insertedLibraries,
      message: `Found ${insertedLibraries.length} libraries. Content sync started in background.`,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;

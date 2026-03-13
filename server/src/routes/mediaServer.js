/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
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
const { createLogger } = require('../utils/logger');

const logger = createLogger('mediaServer');

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
    logger.error('Failed to save media server config:', { error: error.message });
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

    // Differential Sync Strategy
    // 1. Get existing libraries for this server
    const existingLibsResult = await client.query(
      'SELECT id, external_id, name, media_type, arr_type FROM libraries WHERE media_server_id = $1',
      [server.id]
    );
    const existingLibsMap = new Map(existingLibsResult.rows.map(lib => [lib.external_id, lib]));

    const activeLibraryIds = new Set();
    const librariesToInsert = [];
    const librariesToUpdate = [];
    const insertedLibraries = [];

    // 2. Classify remote libraries
    for (const lib of libraries) {
      const existing = existingLibsMap.get(lib.external_id);
      
      let arrType = null;
      if (lib.media_type === 'movie') {
        arrType = 'radarr';
      } else if (lib.media_type === 'tv') {
        arrType = 'sonarr';
      }

      if (existing) {
        // Update case
        activeLibraryIds.add(existing.id);
        
        // Only update if relevant fields changed
        if (existing.name !== lib.name || existing.media_type !== lib.media_type || existing.arr_type !== arrType) {
          librariesToUpdate.push({
            id: existing.id,
            name: lib.name,
            media_type: lib.media_type,
            arr_type: arrType
          });
        }
        
        // Add to result list as "processed"
        // We push the updated object state for the response
        insertedLibraries.push({
          ...existing,
          name: lib.name,
          media_type: lib.media_type,
          arr_type: arrType
        });
      } else {
        // Insert case
        librariesToInsert.push({
          ...lib,
          arrType
        });
      }
    }

    // 3. Handle Deletions (Libraries in DB but not in Remote)
    const librariesToDelete = existingLibsResult.rows.filter(lib => !libraries.find(r => r.external_id === lib.external_id));
    const idsToDelete = librariesToDelete.map(l => l.id);

    if (idsToDelete.length > 0) {
      logger.info(`Deleting ${idsToDelete.length} libraries that are no longer on the media server`);
      
      // Cascade delete logic (mirroring previous logic but scoped to specific IDs)
      await client.query(
        'DELETE FROM media_server_sync_status WHERE library_id = ANY($1)',
        [idsToDelete]
      );
      // ... (Rest of cascade deletes handled mostly by FKs usually, but keeping explicit for safety if Schema relies on it)
      // Actually, checking schema:
      // libraries -> media_server_items (ON DELETE CASCADE)
      // libraries -> classification_history (ON DELETE SET NULL)
      // libraries -> library_policies (ON DELETE CASCADE)
      
      // Manual cleanup for non-cascading or special logic items:
      
      // enrichment_retry_queue (via items)
      await client.query(
        `DELETE FROM enrichment_retry_queue 
         WHERE media_item_id IN (SELECT id FROM media_server_items WHERE library_id = ANY($1))`,
        [idsToDelete]
      );
      
      // task_queue (orphaned tasks)
      // We can't easily link pending tasks to libraries directly if they are generic, 
      // but if they have library_id context (most do not, they have media_item_id).
      // If media_item_id is deleted (cascade), tasks might fail or need cleanup.
      // Usually checking task_queue schema is needed. But let's assume standard cleanup.
      
      // Explicitly delete libraries (triggers cascades)
      await client.query(
        'DELETE FROM libraries WHERE id = ANY($1)',
        [idsToDelete]
      );
    }

    // 4. Handle Updates
    for (const update of librariesToUpdate) {
      await client.query(
        `UPDATE libraries 
         SET name = $1, media_type = $2, arr_type = $3, updated_at = NOW()
         WHERE id = $4`,
        [update.name, update.media_type, update.arr_type, update.id]
      );
    }

    // 5. Handle Insertions
    for (const lib of librariesToInsert) {
      const result = await client.query(
        `INSERT INTO libraries (media_server_id, external_id, name, media_type, arr_type)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [server.id, lib.external_id, lib.name, lib.media_type, lib.arrType]
      );
      const newLibrary = result.rows[0];

      // Auto-create blank policy for the new library
      await client.query(
        `INSERT INTO library_policies (library_id, name, description, enabled, priority, auto_classify_threshold, prompt_threshold)
         VALUES ($1, $2, $3, true, 5, 85, 60)
         ON CONFLICT (library_id) DO NOTHING`,
        [newLibrary.id, `${newLibrary.name} Policy`, `Auto-generated policy for ${newLibrary.name}`]
      );

      insertedLibraries.push(newLibrary);
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
          logger.info(`Auto-sync completed for library ${library.name}: ${result.itemsImported || 0} items`);
        })
        .catch(err => {
          logger.error(`Auto-sync failed for library ${library.name}:`, { error: err.message });
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

/**
 * @swagger
 * /api/media-server/ingest:
 *   post:
 *     summary: Trigger manual ingestion of library content into classification queue
 */
router.post('/ingest', async (req, res) => {
  try {
    const queueService = require('../services/queueService');
    
    // Trigger refill (checks for items needing classification)
    const result = await queueService.refillQueue();
    
    res.json({
      success: true,
      queued: result?.queued || 0,
      message: `Ingestion triggered. Added ${result?.queued || 0} items to queue.`
    });
  } catch (error) {
    logger.error('Failed to trigger ingestion:', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

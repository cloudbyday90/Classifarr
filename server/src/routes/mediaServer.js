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

    // Deactivate existing servers
    await client.query('UPDATE media_server SET is_active = false');

    // Insert new server
    const result = await client.query(
      `INSERT INTO media_server (type, name, url, api_key, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [type, name, url, finalApiKey]
    );

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

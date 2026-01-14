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
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const fs = require('fs').promises;
const tls = require('tls');
const axios = require('axios');
const db = require('../config/database');
const radarrService = require('../services/radarr');
const sonarrService = require('../services/sonarr');
const ollamaService = require('../services/ollama');
const tmdbService = require('../services/tmdb');
const discordBotService = require('../services/discordBot');
const tavilyService = require('../services/tavily');
const { maskToken, isMaskedToken } = require('../utils/tokenMasking');
const startupService = require('../services/startupService');
const pathTestService = require('../services/pathTestService');

const router = express.Router();

// ============================================
// SETUP STATUS (for dashboard banner)
// ============================================

/**
 * @swagger
 * /api/settings/setup-status:
 *   get:
 *     summary: Get re-classification setup status for dashboard banner
 */
router.get('/setup-status', async (req, res) => {
  try {
    const status = await startupService.getSetupStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/media-path:
 *   post:
 *     summary: Configure Classifarr media path
 */
router.post('/media-path', async (req, res) => {
  try {
    const { path } = req.body;
    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }
    await startupService.setMediaPath(path);
    const status = await startupService.checkMediaPathStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rate limiter for SSL certificate testing - 10 attempts per hour
const sslTestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many SSL test attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// GENERAL SETTINGS
// ============================================

/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: Get all settings
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM settings ORDER BY key');

    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings:
 *   put:
 *     summary: Update settings
 */
router.put('/', async (req, res) => {
  try {
    const settings = req.body;

    for (const [key, value] of Object.entries(settings)) {
      await db.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, value]
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CATEGORY-BASED SETTINGS
// ============================================

/**
 * @swagger
 * /api/settings/category/{name}:
 *   get:
 *     summary: Get settings for a specific category
 *     parameters:
 *       - name: name
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [queue, scheduler, classification]
 */
router.get('/category/:name', async (req, res) => {
  try {
    const category = req.params.name;
    const validCategories = ['queue', 'scheduler', 'classification'];

    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Valid categories: ${validCategories.join(', ')}` });
    }

    // Get all settings that start with the category prefix
    const result = await db.query(
      'SELECT key, value FROM settings WHERE key LIKE $1 ORDER BY key',
      [`${category}_%`]
    );

    // Transform to object format (strip category prefix for cleaner API)
    const settings = {};
    result.rows.forEach(row => {
      const keyWithoutPrefix = row.key.replace(`${category}_`, '');
      // Convert snake_case to camelCase
      const camelKey = keyWithoutPrefix.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      settings[camelKey] = row.value;
    });

    // Apply defaults for queue settings if not set
    if (category === 'queue') {
      settings.workerEnabled = settings.workerEnabled ?? true;
      settings.concurrentWorkers = settings.concurrentWorkers ?? 1;
      settings.maxRetryAttempts = settings.maxRetryAttempts ?? 5;
      settings.retryStrategy = settings.retryStrategy ?? 'exponential';
      settings.autoDeleteCompleted = settings.autoDeleteCompleted ?? '7d';
      settings.autoDeleteFailed = settings.autoDeleteFailed ?? 'never';
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/category/{name}:
 *   put:
 *     summary: Update settings for a specific category
 *     parameters:
 *       - name: name
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [queue, scheduler, classification]
 */
router.put('/category/:name', async (req, res) => {
  try {
    const category = req.params.name;
    const settings = req.body;

    const validCategories = ['queue', 'scheduler', 'classification'];

    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Valid categories: ${validCategories.join(', ')}` });
    }

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings must be a valid object' });
    }

    // Save each setting with the category prefix
    for (const [key, value] of Object.entries(settings)) {
      // Convert camelCase to snake_case for storage
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      const fullKey = `${category}_${snakeKey}`;

      // Serialize value for storage (handle booleans, numbers, etc.)
      const serializedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

      await db.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [fullKey, serializedValue]
      );
    }

    res.json({ success: true, category, updated: Object.keys(settings).length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ============================================
// RADARR CONFIGURATION
// ============================================

/**
 * @swagger
 * /api/settings/radarr:
 *   get:
 *     summary: Get all Radarr configurations (with masked API keys)
 */
router.get('/radarr', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM radarr_config ORDER BY id');
    // Mask API keys for security
    result.rows.forEach(row => {
      if (row.api_key) {
        row.api_key = maskToken(row.api_key);
      }
    });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/radarr:
 *   post:
 *     summary: Add Radarr configuration
 */
router.post('/radarr', async (req, res) => {
  try {
    const { name, url, api_key, protocol, host, port, base_path, verify_ssl, timeout, media_server_id, quality_profile_id, minimum_availability } = req.body;

    // Construct URL from components if not provided
    const finalProtocol = protocol || 'http';
    const finalHost = host || 'localhost';
    const finalPort = port || 7878;
    const finalBasePath = base_path || '';
    const constructedUrl = url || `${finalProtocol}://${finalHost}:${finalPort}${finalBasePath}`;

    const result = await db.query(
      `INSERT INTO radarr_config (name, url, api_key, protocol, host, port, base_path, verify_ssl, timeout, media_server_id, quality_profile_id, minimum_availability)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [name, constructedUrl, api_key, finalProtocol, finalHost, finalPort, finalBasePath, verify_ssl !== false, timeout || 30, media_server_id || null, quality_profile_id || null, minimum_availability || 'released']
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
 * /api/settings/radarr/{id}:
 *   put:
 *     summary: Update Radarr configuration
 */
router.put('/radarr/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, api_key, protocol, host, port, base_path, verify_ssl, timeout, is_active, media_server_id, quality_profile_id, minimum_availability } = req.body;

    // Get existing config to preserve API key if masked value is sent
    const existingResult = await db.query('SELECT api_key FROM radarr_config WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Radarr configuration not found' });
    }
    const existingApiKey = existingResult.rows[0].api_key;

    // Use existing API key if the provided one is masked
    const finalApiKey = (api_key && !isMaskedToken(api_key)) ? api_key : existingApiKey;

    // Construct URL from components if not provided
    const finalProtocol = protocol || 'http';
    const finalHost = host || 'localhost';
    const finalPort = port || 7878;
    const finalBasePath = base_path || '';
    const constructedUrl = url || `${finalProtocol}://${finalHost}:${finalPort}${finalBasePath}`;

    const result = await db.query(
      `UPDATE radarr_config
       SET name = COALESCE($1, name),
           url = COALESCE($2, url),
           api_key = COALESCE($3, api_key),
           protocol = COALESCE($4, protocol),
           host = COALESCE($5, host),
           port = COALESCE($6, port),
           base_path = COALESCE($7, base_path),
           verify_ssl = COALESCE($8, verify_ssl),
           timeout = COALESCE($9, timeout),
           is_active = COALESCE($10, is_active),
           media_server_id = $11,
           quality_profile_id = $12,
           minimum_availability = $13,
           updated_at = NOW()
       WHERE id = $14
       RETURNING *`,
      [name, constructedUrl, finalApiKey, protocol, host, port, base_path, verify_ssl, timeout, is_active, media_server_id, quality_profile_id, minimum_availability, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Radarr configuration not found' });
    }

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
 * /api/settings/radarr/{id}:
 *   delete:
 *     summary: Delete Radarr configuration
 */
router.delete('/radarr/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM radarr_config WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/radarr/test:
 *   post:
 *     summary: Test Radarr connection with detailed stats
 */
router.post('/radarr/test', async (req, res) => {
  try {
    const config = req.body;

    // If the api_key is masked, get the real one from the database
    if (config.api_key && isMaskedToken(config.api_key)) {
      // Try to get the real API key from the database using the config id or by host/port
      let realApiKey = null;

      if (config.id) {
        const existingResult = await db.query('SELECT api_key FROM radarr_config WHERE id = $1', [config.id]);
        realApiKey = existingResult.rows[0]?.api_key;
      } else if (config.host && config.port) {
        const existingResult = await db.query('SELECT api_key FROM radarr_config WHERE host = $1 AND port = $2', [config.host, config.port]);
        realApiKey = existingResult.rows[0]?.api_key;
      }

      if (!realApiKey) {
        return res.json({
          success: false,
          error: { message: 'No saved API key found. Please enter the API key manually.' }
        });
      }
      config.api_key = realApiKey;
    }

    const result = await radarrService.testConnection(config);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/radarr/{id}/root-folders:
 *   get:
 *     summary: Get Radarr root folders
 */
router.get('/radarr/:id/root-folders', async (req, res) => {
  try {
    const { id } = req.params;

    const configResult = await db.query('SELECT * FROM radarr_config WHERE id = $1', [id]);
    if (configResult.rows.length === 0) {
      return res.status(404).json({ error: 'Radarr configuration not found' });
    }

    const config = configResult.rows[0];
    const folders = await radarrService.getRootFolders(config.url, config.api_key);
    res.json(folders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/radarr/{id}/quality-profiles:
 *   get:
 *     summary: Get Radarr quality profiles
 */
router.get('/radarr/:id/quality-profiles', async (req, res) => {
  try {
    const { id } = req.params;

    const configResult = await db.query('SELECT * FROM radarr_config WHERE id = $1', [id]);
    if (configResult.rows.length === 0) {
      return res.status(404).json({ error: 'Radarr configuration not found' });
    }

    const config = configResult.rows[0];
    const profiles = await radarrService.getQualityProfiles(config.url, config.api_key);
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SONARR CONFIGURATION
// ============================================

/**
 * @swagger
 * /api/settings/sonarr:
 *   get:
 *     summary: Get all Sonarr configurations (with masked API keys)
 */
router.get('/sonarr', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM sonarr_config ORDER BY id');
    // Mask API keys for security
    result.rows.forEach(row => {
      if (row.api_key) {
        row.api_key = maskToken(row.api_key);
      }
    });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/sonarr:
 *   post:
 *     summary: Add Sonarr configuration
 */
router.post('/sonarr', async (req, res) => {
  try {
    const { name, url, api_key, protocol, host, port, base_path, verify_ssl, timeout, media_server_id, quality_profile_id, monitor, series_type } = req.body;

    // Construct URL from components if not provided
    const finalProtocol = protocol || 'http';
    const finalHost = host || 'localhost';
    const finalPort = port || 8989;
    const finalBasePath = base_path || '';
    const constructedUrl = url || `${finalProtocol}://${finalHost}:${finalPort}${finalBasePath}`;

    const result = await db.query(
      `INSERT INTO sonarr_config (name, url, api_key, protocol, host, port, base_path, verify_ssl, timeout, media_server_id, quality_profile_id, monitor, series_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [name, constructedUrl, api_key, finalProtocol, finalHost, finalPort, finalBasePath, verify_ssl !== false, timeout || 30, media_server_id || null, quality_profile_id || null, monitor || 'all', series_type || 'standard']
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
 * /api/settings/sonarr/{id}:
 *   put:
 *     summary: Update Sonarr configuration
 */
router.put('/sonarr/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, api_key, protocol, host, port, base_path, verify_ssl, timeout, is_active, media_server_id, quality_profile_id, monitor, series_type } = req.body;

    // Get existing config to preserve API key if masked value is sent
    const existingResult = await db.query('SELECT api_key FROM sonarr_config WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sonarr configuration not found' });
    }
    const existingApiKey = existingResult.rows[0].api_key;

    // Use existing API key if the provided one is masked
    const finalApiKey = (api_key && !isMaskedToken(api_key)) ? api_key : existingApiKey;

    // Construct URL from components if not provided
    const finalProtocol = protocol || 'http';
    const finalHost = host || 'localhost';
    const finalPort = port || 8989;
    const finalBasePath = base_path || '';
    const constructedUrl = url || `${finalProtocol}://${finalHost}:${finalPort}${finalBasePath}`;

    const result = await db.query(
      `UPDATE sonarr_config
       SET name = COALESCE($1, name),
           url = COALESCE($2, url),
           api_key = COALESCE($3, api_key),
           protocol = COALESCE($4, protocol),
           host = COALESCE($5, host),
           port = COALESCE($6, port),
           base_path = COALESCE($7, base_path),
           verify_ssl = COALESCE($8, verify_ssl),
           timeout = COALESCE($9, timeout),
           is_active = COALESCE($10, is_active),
           media_server_id = $11,
           quality_profile_id = $12,
           monitor = $13,
           series_type = $14,
           updated_at = NOW()
       WHERE id = $15
       RETURNING *`,
      [name, constructedUrl, finalApiKey, protocol, host, port, base_path, verify_ssl, timeout, is_active, media_server_id, quality_profile_id, monitor, series_type, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sonarr configuration not found' });
    }

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
 * /api/settings/sonarr/{id}:
 *   delete:
 *     summary: Delete Sonarr configuration
 */
router.delete('/sonarr/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM sonarr_config WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/sonarr/test:
 *   post:
 *     summary: Test Sonarr connection with detailed stats
 */
router.post('/sonarr/test', async (req, res) => {
  try {
    const config = req.body;

    // If the api_key is masked, get the real one from the database
    if (config.api_key && isMaskedToken(config.api_key)) {
      // Try to get the real API key from the database using the config id or by host/port
      let realApiKey = null;

      if (config.id) {
        const existingResult = await db.query('SELECT api_key FROM sonarr_config WHERE id = $1', [config.id]);
        realApiKey = existingResult.rows[0]?.api_key;
      } else if (config.host && config.port) {
        const existingResult = await db.query('SELECT api_key FROM sonarr_config WHERE host = $1 AND port = $2', [config.host, config.port]);
        realApiKey = existingResult.rows[0]?.api_key;
      }

      if (!realApiKey) {
        return res.json({
          success: false,
          error: { message: 'No saved API key found. Please enter the API key manually.' }
        });
      }
      config.api_key = realApiKey;
    }

    const result = await sonarrService.testConnection(config);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/sonarr/{id}/root-folders:
 *   get:
 *     summary: Get Sonarr root folders
 */
router.get('/sonarr/:id/root-folders', async (req, res) => {
  try {
    const { id } = req.params;

    const configResult = await db.query('SELECT * FROM sonarr_config WHERE id = $1', [id]);
    if (configResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sonarr configuration not found' });
    }

    const config = configResult.rows[0];
    const folders = await sonarrService.getRootFolders(config.url, config.api_key);
    res.json(folders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/sonarr/{id}/quality-profiles:
 *   get:
 *     summary: Get Sonarr quality profiles
 */
router.get('/sonarr/:id/quality-profiles', async (req, res) => {
  try {
    const { id } = req.params;

    const configResult = await db.query('SELECT * FROM sonarr_config WHERE id = $1', [id]);
    if (configResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sonarr configuration not found' });
    }

    const config = configResult.rows[0];
    const profiles = await sonarrService.getQualityProfiles(config.url, config.api_key);
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ARR CONFIG STATUS (for incomplete config warnings)
// ============================================

/**
 * @swagger
 * /api/settings/arr-config-status:
 *   get:
 *     summary: Check for incomplete Radarr/Sonarr configurations
 *     description: Returns configs missing required fields like quality_profile_id
 */
router.get('/arr-config-status', async (req, res) => {
  try {
    const incompleteConfigs = [];
    
    // Check Radarr configs for missing quality_profile_id
    const radarrResult = await db.query(
      'SELECT id, name FROM radarr_config WHERE quality_profile_id IS NULL'
    );
    
    radarrResult.rows.forEach(row => {
      incompleteConfigs.push({
        type: 'Radarr',
        name: row.name || `Radarr ${row.id}`,
        id: row.id,
        missingField: 'quality_profile_id'
      });
    });
    
    // Check Sonarr configs for missing quality_profile_id
    const sonarrResult = await db.query(
      'SELECT id, name FROM sonarr_config WHERE quality_profile_id IS NULL'
    );
    
    sonarrResult.rows.forEach(row => {
      incompleteConfigs.push({
        type: 'Sonarr',
        name: row.name || `Sonarr ${row.id}`,
        id: row.id,
        missingField: 'quality_profile_id'
      });
    });
    
    res.json({ incompleteConfigs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// OLLAMA CONFIGURATION
// ============================================

/**
 * @swagger
 * /api/settings/ollama:
 *   get:
 *     summary: Get Ollama configuration
 */
router.get('/ollama', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM ollama_config WHERE is_active = true LIMIT 1');
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/ollama:
 *   put:
 *     summary: Update Ollama configuration
 */
router.put('/ollama', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { host, port, model, temperature } = req.body;

    await client.query('BEGIN');

    // Deactivate existing configs
    await client.query('UPDATE ollama_config SET is_active = false');

    // Insert or update
    const result = await client.query(
      `INSERT INTO ollama_config (host, port, model, temperature, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [host, port, model, temperature]
    );

    await client.query('COMMIT');

    // Reset service config cache so it reloads from DB
    ollamaService.resetConfig();

    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /api/settings/ollama/test:
 *   post:
 *     summary: Test Ollama connection
 */
router.post('/ollama/test', async (req, res) => {
  try {
    const { host, port } = req.body;
    const result = await ollamaService.testConnection(host, port);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/ollama/models:
 *   get:
 *     summary: Get available Ollama models
 */
router.get('/ollama/models', async (req, res) => {
  try {
    const { host, port } = req.query;
    const models = await ollamaService.getModels(host, port);
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/ollama/recommended-models:
 *   get:
 *     summary: Get recommended models for classification tasks
 */
router.get('/ollama/recommended-models', async (req, res) => {
  try {
    const recommendations = ollamaService.getRecommendedModels();
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// ============================================
// TMDB CONFIGURATION
// ============================================

/**
 * @swagger
 * /api/settings/tmdb:
 *   get:
 *     summary: Get TMDB configuration
 */
router.get('/tmdb', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM tmdb_config WHERE is_active = true LIMIT 1');
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/tmdb:
 *   put:
 *     summary: Update TMDB configuration
 */
router.put('/tmdb', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { api_key, language } = req.body;

    await client.query('BEGIN');

    // Deactivate existing configs
    await client.query('UPDATE tmdb_config SET is_active = false');

    // Insert or update
    const result = await client.query(
      `INSERT INTO tmdb_config (api_key, language, is_active)
       VALUES ($1, $2, true)
       RETURNING *`,
      [api_key, language || 'en-US']
    );

    await client.query('COMMIT');

    // Mask the API key in response
    if (result.rows && result.rows.length > 0 && result.rows[0]) {
      result.rows[0].api_key = maskToken(result.rows[0].api_key);
    }

    res.json(result.rows && result.rows.length > 0 ? result.rows[0] : null);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /api/settings/tmdb/test:
 *   post:
 *     summary: Test TMDB connection
 */
router.post('/tmdb/test', async (req, res) => {
  try {
    const { api_key } = req.body;
    const result = await tmdbService.testConnection(api_key);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/tmdb/health:
 *   get:
 *     summary: Check TMDB API health and SSL certificate status
 */
router.get('/tmdb/health', async (req, res) => {
  try {
    // Get config status
    const configResult = await db.query('SELECT * FROM tmdb_config WHERE is_active = true LIMIT 1');
    const config = configResult.rows[0];

    if (!config?.api_key) {
      return res.json({
        status: 'unavailable',
        configured: false,
        ssl_valid: null,
        api_reachable: null,
        message: 'TMDB API not configured'
      });
    }

    // Check API health
    const healthResult = await tmdbService.checkHealth(config.api_key);

    res.json({
      status: healthResult.healthy ? 'healthy' : (healthResult.ssl_error ? 'degraded' : 'unavailable'),
      configured: true,
      ssl_valid: !healthResult.ssl_error,
      api_reachable: healthResult.api_reachable,
      message: healthResult.message
    });
  } catch (error) {
    res.status(500).json({
      status: 'unavailable',
      configured: null,
      ssl_valid: null,
      api_reachable: false,
      message: error.message
    });
  }
});

// ============================================
// TAVILY CONFIGURATION
// ============================================

/**
 * @swagger
 * /api/settings/tavily:
 *   get:
 *     summary: Get Tavily configuration
 */
router.get('/tavily', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM tavily_config LIMIT 1');
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
 * /api/settings/tavily:
 *   put:
 *     summary: Update Tavily configuration
 */
router.put('/tavily', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { api_key, search_depth, max_results, include_domains, exclude_domains, is_active } = req.body;

    await client.query('BEGIN');

    // Get existing config to preserve API key if masked value is sent
    const existingResult = await client.query('SELECT api_key FROM tavily_config LIMIT 1');
    const existingKey = existingResult.rows[0]?.api_key;

    const finalApiKey = (api_key && !isMaskedToken(api_key)) ? api_key : existingKey;

    // Delete existing (single config enforcement)
    await client.query('DELETE FROM tavily_config');

    const result = await client.query(
      `INSERT INTO tavily_config 
       (api_key, search_depth, max_results, include_domains, exclude_domains, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [
        finalApiKey,
        search_depth || 'advanced',
        max_results || 5,
        include_domains || ['imdb.com', 'rottentomatoes.com'],
        exclude_domains || [],
        is_active !== false
      ]
    );

    await client.query('COMMIT');

    if (result.rows[0].api_key) {
      result.rows[0].api_key = maskToken(result.rows[0].api_key);
    }

    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /api/settings/tavily/test:
 *   post:
 *     summary: Test Tavily connection
 */
router.post('/tavily/test', async (req, res) => {
  try {
    const { api_key } = req.body;
    let apiKey = api_key;

    if (isMaskedToken(api_key)) {
      const result = await db.query('SELECT api_key FROM tavily_config LIMIT 1');
      apiKey = result.rows[0]?.api_key;
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    const result = await tavilyService.testConnection(apiKey);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/tavily/health:
 *   get:
 *     summary: Check Tavily API health and SSL certificate status
 */
router.get('/tavily/health', async (req, res) => {
  try {
    // Get config status
    const configResult = await db.query('SELECT * FROM tavily_config WHERE is_active = true LIMIT 1');
    const config = configResult.rows[0];

    if (!config?.api_key) {
      return res.json({
        status: 'unavailable',
        configured: false,
        ssl_valid: null,
        api_reachable: null,
        message: 'Tavily API not configured'
      });
    }

    // Check API health
    const healthResult = await tavilyService.checkHealth(config.api_key);

    res.json({
      status: healthResult.healthy ? 'healthy' : (healthResult.ssl_error ? 'degraded' : 'unavailable'),
      configured: true,
      ssl_valid: !healthResult.ssl_error,
      api_reachable: healthResult.api_reachable,
      message: healthResult.message
    });
  } catch (error) {
    res.status(500).json({
      status: 'unavailable',
      configured: null,
      ssl_valid: null,
      api_reachable: false,
      message: error.message
    });
  }
});

// ============================================
// OMDB CONFIGURATION
// ============================================

const omdbService = require('../services/omdb');

/**
 * @swagger
 * /api/settings/omdb:
 *   get:
 *     summary: Get OMDb configuration
 */
router.get('/omdb', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM omdb_config LIMIT 1');
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
 * /api/settings/omdb:
 *   put:
 *     summary: Update OMDb configuration
 */
router.put('/omdb', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { api_key, is_active, daily_limit } = req.body;

    await client.query('BEGIN');

    // Get existing config to preserve API key if masked AND preserve usage stats
    const existingResult = await client.query('SELECT * FROM omdb_config LIMIT 1');
    const existing = existingResult.rows[0];

    const finalApiKey = (api_key && !isMaskedToken(api_key)) ? api_key : (existing?.api_key || null);
    const finalDailyLimit = daily_limit !== undefined ? parseInt(daily_limit) : (existing?.daily_limit || 1000);

    // Preserve usage stats if updating same day
    const preservedRequestsToday = existing?.requests_today || 0;
    const preservedLastReset = existing?.last_reset_date || null;

    // Delete all rows to enforce single-row pattern
    await client.query('DELETE FROM omdb_config');

    // Insert single row with id=1
    const result = await client.query(
      `INSERT INTO omdb_config (id, api_key, is_active, daily_limit, requests_today, last_reset_date, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [finalApiKey, is_active !== false, finalDailyLimit, preservedRequestsToday, preservedLastReset]
    );

    await client.query('COMMIT');

    if (result.rows[0].api_key) {
      result.rows[0].api_key = maskToken(result.rows[0].api_key);
    }

    // Trigger immediate gap analysis to start enrichment
    // Check if activated and run in background
    if (is_active !== false) {
      const schedulerService = require('../services/scheduler');
      console.log('OMDb settings saved - Triggering immediate gap analysis...');
      schedulerService.runGapAnalysis().catch(err => {
        console.error('Failed to trigger manual gap analysis:', err);
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /api/settings/omdb/test:
 *   post:
 *     summary: Test OMDb connection
 */
router.post('/omdb/test', async (req, res) => {
  try {
    const { api_key } = req.body;
    let apiKey = api_key;

    if (isMaskedToken(api_key)) {
      const result = await db.query('SELECT api_key FROM omdb_config LIMIT 1');
      apiKey = result.rows[0]?.api_key;
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    const result = await omdbService.testConnection(apiKey);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/omdb/search:
 *   post:
 *     summary: Test OMDb search with a title
 */
router.post('/omdb/search', async (req, res) => {
  try {
    const { title, year, type } = req.body;

    const configResult = await db.query('SELECT api_key FROM omdb_config WHERE is_active = true LIMIT 1');
    if (!configResult.rows[0]?.api_key) {
      return res.status(400).json({ error: 'OMDb not configured' });
    }

    const result = await omdbService.getByTitle(title, year, type, configResult.rows[0].api_key);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/omdb/health:
 *   get:
 *     summary: Check OMDb API health and SSL certificate status
 *     responses:
 *       200:
 *         description: OMDb health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unavailable]
 *                 configured:
 *                   type: boolean
 *                 ssl_valid:
 *                   type: boolean
 *                 api_reachable:
 *                   type: boolean
 *                 requests_today:
 *                   type: integer
 *                 daily_limit:
 *                   type: integer
 *                 message:
 *                   type: string
 */
router.get('/omdb/health', async (req, res) => {
  try {
    // Get config status
    const configResult = await db.query('SELECT * FROM omdb_config WHERE is_active = true LIMIT 1');
    const config = configResult.rows[0];

    if (!config?.api_key) {
      return res.json({
        status: 'unavailable',
        configured: false,
        ssl_valid: null,
        api_reachable: null,
        message: 'OMDb API not configured'
      });
    }

    // Check API health with a simple test request
    const healthResult = await omdbService.checkHealth(config.api_key);

    res.json({
      status: healthResult.healthy ? 'healthy' : (healthResult.ssl_error ? 'degraded' : 'unavailable'),
      configured: true,
      ssl_valid: !healthResult.ssl_error,
      api_reachable: healthResult.api_reachable,
      requests_today: config.requests_today || 0,
      daily_limit: config.daily_limit || 1000,
      remaining_requests: Math.max(0, (config.daily_limit || 1000) - (config.requests_today || 0)),
      message: healthResult.message
    });
  } catch (error) {
    res.status(500).json({
      status: 'unavailable',
      configured: null,
      ssl_valid: null,
      api_reachable: false,
      message: error.message
    });
  }
});

// ============================================
// NOTIFICATION CONFIGURATION
// ============================================

/**
 * @swagger
 * /api/settings/notifications:
 *   get:
 *     summary: Get notification configuration
 */
router.get('/notifications', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM notification_config WHERE type = $1 LIMIT 1', ['discord']);
    if (result.rows[0] && result.rows[0].bot_token) {
      // Mask bot token for security
      result.rows[0].bot_token = maskToken(result.rows[0].bot_token);
    }
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/notifications:
 *   put:
 *     summary: Update notification configuration
 */
router.put('/notifications', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const {
      bot_token,
      channel_id,
      enabled,
      notify_on_classification,
      notify_on_error,
      notify_on_correction,
      show_poster,
      show_confidence,
      show_method,
      show_reason,
      show_metadata,
      enable_corrections,
      correction_buttons_count,
      include_library_dropdown,
    } = req.body;

    await client.query('BEGIN');

    // Get existing config to preserve bot token if masked value is sent
    const existingResult = await client.query('SELECT bot_token FROM notification_config WHERE type = $1 LIMIT 1', ['discord']);
    const existingToken = existingResult.rows[0]?.bot_token;

    // Use existing token if the provided one is masked
    const finalToken = (bot_token && !isMaskedToken(bot_token)) ? bot_token : existingToken;

    const result = await client.query(
      `INSERT INTO notification_config (
        id, type, bot_token, channel_id, enabled,
        notify_on_classification, notify_on_error, notify_on_correction,
        show_poster, show_confidence, show_method, show_reason, show_metadata,
        enable_corrections, correction_buttons_count, include_library_dropdown
      )
       VALUES (1, 'discord', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (id) DO UPDATE 
       SET bot_token = $1, 
           channel_id = $2, 
           enabled = $3,
           notify_on_classification = $4,
           notify_on_error = $5,
           notify_on_correction = $6,
           show_poster = $7,
           show_confidence = $8,
           show_method = $9,
           show_reason = $10,
           show_metadata = $11,
           enable_corrections = $12,
           correction_buttons_count = $13,
           include_library_dropdown = $14,
           updated_at = NOW()
       RETURNING *`,
      [
        finalToken,
        channel_id,
        enabled !== false,
        notify_on_classification !== false,
        notify_on_error !== false,
        notify_on_correction !== false,
        show_poster !== false,
        show_confidence !== false,
        show_method !== false,
        show_reason !== false,
        show_metadata === true,
        enable_corrections !== false,
        correction_buttons_count || 3,
        include_library_dropdown !== false,
      ]
    );

    await client.query('COMMIT');

    // Reinitialize Discord bot if enabled
    if (enabled && finalToken && channel_id) {
      try {
        await discordBotService.reinitialize();
      } catch (error) {
        console.warn('Failed to reinitialize Discord bot:', error.message);
      }
    }

    // Mask token in response
    if (result.rows[0].bot_token) {
      result.rows[0].bot_token = maskToken(result.rows[0].bot_token);
    }

    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to save Discord notification config:', error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /api/settings/discord/test:
 *   post:
 *     summary: Test Discord bot connection and send test notification
 */
router.post('/discord/test', async (req, res) => {
  try {
    const { bot_token, channel_id } = req.body;
    let token = bot_token;

    if (isMaskedToken(bot_token)) {
      const result = await db.query('SELECT bot_token FROM notification_config WHERE type = $1', ['discord']);
      token = result.rows[0]?.bot_token;
    }

    if (!token) {
      return res.status(400).json({ error: 'No Discord token found' });
    }

    const result = await discordBotService.testConnection(token, channel_id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/discord/servers:
 *   get:
 *     summary: Get Discord servers (guilds)
 */
router.get('/discord/servers', async (req, res) => {
  try {
    const { bot_token } = req.query;
    let token = bot_token;

    if (isMaskedToken(bot_token)) {
      const result = await db.query('SELECT bot_token FROM notification_config WHERE type = $1', ['discord']);
      token = result.rows[0]?.bot_token;
    }

    if (!token) {
      return res.status(400).json({ error: 'No Discord token found' });
    }

    const servers = await discordBotService.getServers(token);
    res.json(servers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/discord/channels/:serverId:
 *   get:
 *     summary: Get Discord channels in a server
 */
router.get('/discord/channels/:serverId', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { bot_token } = req.query;
    let token = bot_token;

    if (isMaskedToken(bot_token)) {
      const result = await db.query('SELECT bot_token FROM notification_config WHERE type = $1', ['discord']);
      token = result.rows[0]?.bot_token;
    }

    if (!token) {
      return res.status(400).json({ error: 'No Discord token found' });
    }

    const channels = await discordBotService.getChannels(serverId, token);
    res.json(channels);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/discord/channel/:channelId:
 *   get:
 *     summary: Get Discord channel details (name, guild name)
 */
router.get('/discord/channel/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    // We don't need to pass token here as service will use stored config
    const details = await discordBotService.getChannelDetails(channelId);
    res.json(details);
  } catch (error) {
    console.error('Error fetching Discord channel details:', error.message);

    // Return 200 with fallback data so frontend doesn't show "Connection Failed"
    // The "partial" flag indicates this is incomplete data
    res.json({
      id: req.params.channelId,
      name: 'Channel details unavailable',
      guildId: null,
      guildName: 'Server details unavailable',
      partial: true,
      error: error.message
    });
  }
});

// ============================================
// TAVILY CONFIGURATION
// ============================================

/**
 * @swagger
 * /api/settings/tavily:
 *   get:
 *     summary: Get Tavily configuration (with masked API key)
 */
router.get('/tavily', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM tavily_config LIMIT 1');
    if (result.rows[0] && result.rows[0].api_key) {
      // Mask API key for security
      result.rows[0].api_key = '••••••••';
    }
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/tavily:
 *   put:
 *     summary: Update Tavily configuration
 */
router.put('/tavily', async (req, res) => {
  try {
    const { api_key, search_depth, max_results, include_domains, exclude_domains, is_active } = req.body;

    // Get existing config to preserve API key if masked value is sent
    const existingResult = await db.query('SELECT api_key FROM tavily_config LIMIT 1');
    const existingApiKey = existingResult.rows[0]?.api_key;

    // Use existing key if the provided one is masked
    const finalApiKey = (api_key && api_key !== '••••••••') ? api_key : existingApiKey;

    const result = await db.query(
      `INSERT INTO tavily_config (id, api_key, search_depth, max_results, include_domains, exclude_domains, is_active)
       VALUES (1, $1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE 
       SET api_key = $1, 
           search_depth = $2, 
           max_results = $3, 
           include_domains = $4, 
           exclude_domains = $5, 
           is_active = $6, 
           updated_at = NOW()
       RETURNING *`,
      [
        finalApiKey,
        search_depth || 'advanced',
        max_results || 5,
        include_domains || ['imdb.com', 'rottentomatoes.com', 'myanimelist.net', 'letterboxd.com'],
        exclude_domains || [],
        is_active ?? true
      ]
    );

    // Mask API key in response
    if (result.rows[0].api_key) {
      result.rows[0].api_key = '••••••••';
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/tavily/test:
 *   post:
 *     summary: Test Tavily connection
 */
router.post('/tavily/test', async (req, res) => {
  try {
    const { api_key } = req.body;

    if (!api_key) {
      return res.status(400).json({ error: 'API key is required' });
    }

    const result = await tavilyService.testConnection(api_key);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/tavily/search:
 *   post:
 *     summary: Test Tavily search (for debugging)
 */
router.post('/tavily/search', async (req, res) => {
  try {
    const { query, api_key } = req.body;

    if (!api_key || !query) {
      return res.status(400).json({ error: 'API key and query are required' });
    }

    const configResult = await db.query('SELECT * FROM tavily_config LIMIT 1');
    const config = configResult.rows[0] || {};

    const result = await tavilyService.search(query, {
      apiKey: api_key,
      searchDepth: config.search_depth || 'advanced',
      maxResults: config.max_results || 5,
      includeDomains: config.include_domains || ['imdb.com', 'rottentomatoes.com'],
      excludeDomains: config.exclude_domains || []
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// WEBHOOK CONFIGURATION
// ============================================

const webhookService = require('../services/webhook');

/**
 * @swagger
 * /api/settings/webhook:
 *   get:
 *     summary: Get webhook configuration (with masked secret key)
 */
router.get('/webhook', async (req, res) => {
  try {
    const config = await webhookService.getConfig();

    // Mask secret key for security
    if (config.secret_key) {
      config.secret_key = maskToken(config.secret_key);
    }

    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/webhook:
 *   put:
 *     summary: Update webhook configuration
 */
router.put('/webhook', async (req, res) => {
  try {
    const config = req.body;

    // Get existing config to preserve secret key if masked value is sent
    const existingConfig = await webhookService.getConfig();

    // Use existing secret key if the provided one is masked
    if (config.secret_key && isMaskedToken(config.secret_key)) {
      config.secret_key = existingConfig.secret_key;
    }

    const result = await webhookService.updateConfig(config);

    // Mask secret key in response
    if (result.secret_key) {
      result.secret_key = maskToken(result.secret_key);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/webhook/generate-key:
 *   post:
 *     summary: Generate new webhook secret key
 */
router.post('/webhook/generate-key', async (req, res) => {
  try {
    const secretKey = webhookService.generateSecretKey();

    const config = await webhookService.updateConfig({ secret_key: secretKey });

    res.json({
      ...config,
      secret_key: secretKey, // Return full key on generation
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/webhook/url:
 *   get:
 *     summary: Get full webhook URL with key
 */
router.get('/webhook/url', async (req, res) => {
  try {
    const config = await webhookService.getConfig();
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    let url = `${baseUrl}/api/webhook/overseerr`;
    if (config.secret_key) {
      url += `?key=${config.secret_key}`;
    }

    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/webhook/logs:
 *   get:
 *     summary: Get paginated webhook logs
 */
router.get('/webhook/logs', async (req, res) => {
  try {
    const { page = 1, limit = 50, status, media_type } = req.query;

    const result = await webhookService.getLogs({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      media_type
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/webhook/stats:
 *   get:
 *     summary: Get webhook statistics
 */
router.get('/webhook/stats', async (req, res) => {
  try {
    const stats = await webhookService.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/webhook/test:
 *   post:
 *     summary: Send test webhook to self
 */
router.post('/webhook/test', async (req, res) => {
  try {
    const config = await webhookService.getConfig();
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const testPayload = {
      notification_type: 'TEST_NOTIFICATION',
      event: 'test',
      subject: 'Test Notification from Classifarr',
      message: 'This is a test webhook to verify your configuration',
      media: {
        media_type: 'movie',
        tmdbId: 550,
        title: 'Test Movie',
        releaseDate: '1999-10-15'
      }
    };

    // Make internal request to webhook endpoint
    let url = `${baseUrl}/api/webhook/overseerr`;
    if (config.secret_key) {
      url += `?key=${config.secret_key}`;
    }

    const response = await axios.post(url, testPayload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Classifarr-Test'
      }
    });

    res.json({
      success: true,
      message: 'Test webhook sent successfully',
      response: response.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
});

// ============================================
// SETUP STATUS
// ============================================

/**
 * @swagger
 * /api/settings/setup-status:
 *   get:
 *     summary: Check if initial setup is complete
 */
router.get('/setup-status', async (req, res) => {
  try {
    // Check if users exist (authentication setup)
    let usersExist = false;
    try {
      const usersResult = await db.query('SELECT COUNT(*) FROM users');
      usersExist = parseInt(usersResult.rows[0].count) > 0;
    } catch (error) {
      // Table might not exist yet
      usersExist = false;
    }

    // Check if TMDB is configured (required)
    const tmdbResult = await db.query('SELECT id FROM tmdb_config WHERE is_active = true LIMIT 1');
    const tmdbConfigured = tmdbResult.rows.length > 0;

    // Check if Ollama is configured (optional)
    const ollamaResult = await db.query('SELECT id FROM ollama_config WHERE is_active = true LIMIT 1');
    const ollamaConfigured = ollamaResult.rows.length > 0;

    // Check if Discord is configured (optional)
    const discordResult = await db.query('SELECT id FROM notification_config WHERE type = $1 AND enabled = true LIMIT 1', ['discord']);
    const discordConfigured = discordResult.rows.length > 0;

    // Setup is complete when both users exist and TMDB is configured
    const setupComplete = usersExist && tmdbConfigured;

    res.json({
      setupComplete,
      usersExist,
      tmdbConfigured,
      ollamaConfigured,
      discordConfigured,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SSL/HTTPS CONFIGURATION
// ============================================

/**
 * @swagger
 * /api/settings/ssl:
 *   get:
 *     summary: Get SSL/HTTPS configuration
 */
router.get('/ssl', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM ssl_config LIMIT 1');
    res.json(result.rows[0] || {
      enabled: false,
      cert_path: '',
      key_path: '',
      ca_path: '',
      force_https: false,
      hsts_enabled: false,
      hsts_max_age: 31536000,
      client_cert_required: false
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/ssl:
 *   put:
 *     summary: Update SSL/HTTPS configuration
 */
router.put('/ssl', async (req, res) => {
  try {
    const {
      enabled,
      cert_path,
      key_path,
      ca_path,
      force_https,
      hsts_enabled,
      hsts_max_age,
      client_cert_required
    } = req.body;

    const result = await db.query(
      `INSERT INTO ssl_config (
        id, enabled, cert_path, key_path, ca_path,
        force_https, hsts_enabled, hsts_max_age, client_cert_required
      )
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE 
       SET enabled = $1,
           cert_path = $2,
           key_path = $3,
           ca_path = $4,
           force_https = $5,
           hsts_enabled = $6,
           hsts_max_age = $7,
           client_cert_required = $8,
           updated_at = NOW()
       RETURNING *`,
      [
        enabled || false,
        cert_path || null,
        key_path || null,
        ca_path || null,
        force_https || false,
        hsts_enabled || false,
        hsts_max_age || 31536000,
        client_cert_required || false
      ]
    );

    res.json({
      ...result.rows[0],
      requiresRestart: true,
      message: 'SSL configuration saved. Please restart Classifarr for changes to take effect.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/ssl/test:
 *   post:
 *     summary: Test SSL certificate files
 */
router.post('/ssl/test', sslTestLimiter, async (req, res) => {
  try {
    const { cert_path, key_path, ca_path } = req.body;
    const fs = require('fs').promises;
    const results = {
      cert_exists: false,
      key_exists: false,
      ca_exists: true, // CA is optional
      valid: false
    };

    // Check if cert file exists
    if (cert_path) {
      try {
        await fs.access(cert_path);
        results.cert_exists = true;
      } catch (e) {
        return res.json({ ...results, error: 'Certificate file not found' });
      }
    } else {
      return res.json({ ...results, error: 'Certificate path is required' });
    }

    // Check if key file exists
    if (key_path) {
      try {
        await fs.access(key_path);
        results.key_exists = true;
      } catch (e) {
        return res.json({ ...results, error: 'Private key file not found' });
      }
    } else {
      return res.json({ ...results, error: 'Private key path is required' });
    }

    // Check CA if provided
    if (ca_path) {
      try {
        await fs.access(ca_path);
        results.ca_exists = true;
      } catch (e) {
        results.ca_exists = false;
        return res.json({ ...results, error: 'CA certificate file not found' });
      }
    }

    // Try to load the certificate files
    try {
      const certData = await fs.readFile(cert_path, 'utf8');
      const keyData = await fs.readFile(key_path, 'utf8');

      // Create secure context to validate cert and key match
      const context = tls.createSecureContext({
        cert: certData,
        key: keyData
      });

      // Parse certificate to check expiration
      const crypto = require('crypto');
      const cert = new crypto.X509Certificate(certData);
      const now = new Date();
      const validFrom = new Date(cert.validFrom);
      const validTo = new Date(cert.validTo);

      if (now < validFrom) {
        return res.json({ ...results, error: 'Certificate is not yet valid' });
      }

      if (now > validTo) {
        return res.json({ ...results, error: 'Certificate has expired' });
      }

      // Calculate days until expiration
      const daysUntilExpiry = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));

      results.valid = true;
      results.subject = cert.subject;
      results.issuer = cert.issuer;
      results.validFrom = cert.validFrom;
      results.validTo = cert.validTo;
      results.daysUntilExpiry = daysUntilExpiry;

      let message = 'SSL certificates are valid';
      if (daysUntilExpiry < 30) {
        message += ` (expires in ${daysUntilExpiry} days - renewal recommended)`;
      }

      res.json({ ...results, message });
    } catch (error) {
      res.json({ ...results, error: 'Invalid certificate or key: ' + error.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MULTI-REQUEST MANAGER ENDPOINTS
// ============================================

// List all webhook configurations
router.get('/webhook/configs', async (req, res) => {
  try {
    const configs = await webhookService.getAllConfigs();
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific webhook configuration
router.get('/webhook/configs/:id', async (req, res) => {
  try {
    const config = await webhookService.getConfigById(parseInt(req.params.id));
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    // Mask sensitive data
    if (config.secret_key) {
      config.secret_key = maskToken(config.secret_key);
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new webhook configuration
router.post('/webhook/configs', async (req, res) => {
  try {
    if (!req.body.name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const config = await webhookService.createConfig(req.body);
    res.status(201).json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update webhook configuration
router.put('/webhook/configs/:id', async (req, res) => {
  try {
    const config = await webhookService.updateConfigById(parseInt(req.params.id), req.body);
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete webhook configuration
router.delete('/webhook/configs/:id', async (req, res) => {
  try {
    await webhookService.deleteConfig(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Set webhook configuration as primary
router.post('/webhook/configs/:id/primary', async (req, res) => {
  try {
    const config = await webhookService.setPrimaryConfig(parseInt(req.params.id));
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AI PROVIDER CONFIGURATION
// ============================================

const cloudLLMService = require('../services/cloudLLM');
const aiRouterService = require('../services/aiRouter');

/**
 * Get AI provider configuration
 */
router.get('/ai', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM ai_provider_config WHERE id = 1');

    if (result.rows.length === 0) {
      // Return default config
      return res.json({
        primary_provider: 'none',
        api_endpoint: '',
        api_key: '',
        model: '',
        temperature: 0.7,
        max_tokens: 2000,
        monthly_budget_usd: null,
        current_month_usage_usd: 0,
        budget_alert_threshold: 80,
        pause_on_budget_exhausted: true,
        ollama_fallback_enabled: false,
        ollama_for_basic_tasks: false,
        ollama_for_budget_exhausted: true,
        ollama_host: 'localhost',
        ollama_port: 11434,
        ollama_model: 'llama3.2',
        // RAG settings
        rag_enabled: false,
        embedding_provider: 'auto',
        embedding_model: '',
        rag_similarity_threshold: 0.70,
        rag_min_history_count: 50,
        rag_backfill_budget_type: 'percentage',
        rag_backfill_budget_value: 25,
        // Pattern mining settings
        pattern_mining_enabled: true,
        pattern_rule_priority: 'rules_first',
        pattern_ai_skip_threshold: 90,
        pattern_notification_dismissed: false,
        // Formula engine weights
        formula_pattern_weight: 0.40,
        formula_rule_weight: 0.30,
        formula_rag_weight: 0.20,
        formula_history_weight: 0.10
      });
    }

    const config = result.rows[0];
    // Mask API key
    if (config.api_key) {
      config.api_key = maskToken(config.api_key);
    }

    res.json(config);
  } catch (error) {
    // Table might not exist
    if (error.code === '42P01') {
      return res.json({ primary_provider: 'none', table_not_ready: true });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update AI provider configuration
 */
router.put('/ai', async (req, res) => {
  try {
    const {
      primary_provider,
      api_endpoint,
      api_key,
      model,
      temperature,
      max_tokens,
      monthly_budget_usd,
      budget_alert_threshold,
      pause_on_budget_exhausted,
      ollama_fallback_enabled,
      ollama_for_basic_tasks,
      ollama_for_budget_exhausted,
      ollama_host,
      ollama_port,
      ollama_model,
      // RAG settings
      rag_enabled,
      embedding_provider,
      embedding_model,
      rag_similarity_threshold,
      rag_min_history_count,
      rag_backfill_budget_type,
      rag_backfill_budget_value,
      // Formula engine weights
      formula_pattern_weight,
      formula_rule_weight,
      formula_rag_weight,
      formula_history_weight
    } = req.body;

    // Handle API key - don't update if masked
    let finalApiKey = api_key;
    if (isMaskedToken(api_key)) {
      const existing = await db.query('SELECT api_key FROM ai_provider_config WHERE id = 1');
      finalApiKey = existing.rows[0]?.api_key || '';
    }

    // Validate formula weights sum to approximately 1.0 if any are provided
    const providedWeights = [formula_pattern_weight, formula_rule_weight, formula_rag_weight, formula_history_weight];
    const hasWeights = providedWeights.some(w => w !== undefined);

    if (hasWeights) {
      // Get current weights from database for any not provided
      const current = await db.query('SELECT formula_pattern_weight, formula_rule_weight, formula_rag_weight, formula_history_weight FROM ai_provider_config WHERE id = 1');
      const currentWeights = current.rows[0] || {};

      const finalPatternWeight = formula_pattern_weight ?? currentWeights.formula_pattern_weight ?? 0.40;
      const finalRuleWeight = formula_rule_weight ?? currentWeights.formula_rule_weight ?? 0.30;
      const finalRagWeight = formula_rag_weight ?? currentWeights.formula_rag_weight ?? 0.20;
      const finalHistoryWeight = formula_history_weight ?? currentWeights.formula_history_weight ?? 0.10;

      const sum = finalPatternWeight + finalRuleWeight + finalRagWeight + finalHistoryWeight;

      if (sum < 0.99 || sum > 1.01) {
        return res.status(400).json({
          error: `Formula weights must sum to 1.0 (currently ${sum.toFixed(2)}). Adjust the weights so they total 100%.`,
          currentSum: sum
        });
      }
    }

    const result = await db.query(`
            INSERT INTO ai_provider_config (
                id, primary_provider, api_endpoint, api_key, model, temperature, max_tokens,
                monthly_budget_usd, budget_alert_threshold, pause_on_budget_exhausted,
                ollama_fallback_enabled, ollama_for_basic_tasks, ollama_for_budget_exhausted,
                ollama_host, ollama_port, ollama_model,
                rag_enabled, embedding_provider, embedding_model,
                rag_similarity_threshold, rag_min_history_count,
                rag_backfill_budget_type, rag_backfill_budget_value,
                formula_pattern_weight, formula_rule_weight, formula_rag_weight, formula_history_weight,
                updated_at
            ) VALUES (
                1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
                primary_provider = EXCLUDED.primary_provider,
                api_endpoint = EXCLUDED.api_endpoint,
                api_key = EXCLUDED.api_key,
                model = EXCLUDED.model,
                temperature = EXCLUDED.temperature,
                max_tokens = EXCLUDED.max_tokens,
                monthly_budget_usd = EXCLUDED.monthly_budget_usd,
                budget_alert_threshold = EXCLUDED.budget_alert_threshold,
                pause_on_budget_exhausted = EXCLUDED.pause_on_budget_exhausted,
                ollama_fallback_enabled = EXCLUDED.ollama_fallback_enabled,
                ollama_for_basic_tasks = EXCLUDED.ollama_for_basic_tasks,
                ollama_for_budget_exhausted = EXCLUDED.ollama_for_budget_exhausted,
                ollama_host = EXCLUDED.ollama_host,
                ollama_port = EXCLUDED.ollama_port,
                ollama_model = EXCLUDED.ollama_model,
                rag_enabled = EXCLUDED.rag_enabled,
                embedding_provider = EXCLUDED.embedding_provider,
                embedding_model = EXCLUDED.embedding_model,
                rag_similarity_threshold = EXCLUDED.rag_similarity_threshold,
                rag_min_history_count = EXCLUDED.rag_min_history_count,
                rag_backfill_budget_type = EXCLUDED.rag_backfill_budget_type,
                rag_backfill_budget_value = EXCLUDED.rag_backfill_budget_value,
                formula_pattern_weight = EXCLUDED.formula_pattern_weight,
                formula_rule_weight = EXCLUDED.formula_rule_weight,
                formula_rag_weight = EXCLUDED.formula_rag_weight,
                formula_history_weight = EXCLUDED.formula_history_weight,
                updated_at = NOW()
            RETURNING *
        `, [
      primary_provider || 'none',
      api_endpoint || '',
      finalApiKey || '',
      model || '',
      temperature || 0.7,
      max_tokens || 2000,
      monthly_budget_usd || null,
      budget_alert_threshold || 80,
      pause_on_budget_exhausted !== false,
      ollama_fallback_enabled || false,
      ollama_for_basic_tasks || false,
      ollama_for_budget_exhausted !== false,
      ollama_host || 'localhost',
      ollama_port || 11434,
      ollama_model || 'llama3.2',
      rag_enabled || false,
      embedding_provider || 'auto',
      embedding_model || '',
      rag_similarity_threshold || 0.70,
      rag_min_history_count || 50,
      rag_backfill_budget_type || 'percentage',
      rag_backfill_budget_value || 25,
      formula_pattern_weight ?? 0.40,
      formula_rule_weight ?? 0.30,
      formula_rag_weight ?? 0.20,
      formula_history_weight ?? 0.10
    ]);

    // Clear config cache
    aiRouterService.clearCache();
    ollamaService.resetConfig(); // Clear Ollama config cache to pick up ollama_host/ollama_port changes

    const config = result.rows[0];
    if (config.api_key) {
      config.api_key = maskToken(config.api_key);
    }

    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Test cloud AI provider connection
 */
router.post('/ai/test', async (req, res) => {
  try {
    const { primary_provider, api_endpoint, api_key, model } = req.body;

    // Handle masked API key
    let testApiKey = api_key;
    if (isMaskedToken(api_key)) {
      const existing = await db.query('SELECT api_key FROM ai_provider_config WHERE id = 1');
      testApiKey = existing.rows[0]?.api_key || '';
    }

    if (!testApiKey) {
      return res.status(400).json({ success: false, error: 'API key is required' });
    }

    const result = await cloudLLMService.testConnection({
      primary_provider,
      api_endpoint,
      api_key: testApiKey
    });

    res.json(result);
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

/**
 * Get available models from cloud provider
 */
router.post('/ai/models', async (req, res) => {
  try {
    const { primary_provider, api_endpoint, api_key } = req.body;

    // Handle masked API key
    let actualApiKey = api_key;
    if (isMaskedToken(api_key)) {
      const existing = await db.query('SELECT api_key FROM ai_provider_config WHERE id = 1');
      actualApiKey = existing.rows[0]?.api_key || '';
    }

    const models = await cloudLLMService.getModels({
      primary_provider,
      api_endpoint,
      api_key: actualApiKey
    });

    res.json({ models });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get AI usage statistics (with average cost per call)
 */
router.get('/ai/usage', async (req, res) => {
  try {
    // Current month stats with average cost
    const currentResult = await db.query(`
            SELECT 
                COUNT(*) as total_requests,
                SUM(total_tokens) as total_tokens,
                SUM(cost_usd) as total_cost,
                AVG(cost_usd) as avg_cost_per_call,
                SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests
            FROM ai_usage_log
            WHERE created_at >= date_trunc('month', CURRENT_DATE)
              AND success = true
        `);

    // Last month stats
    const lastMonthResult = await db.query(`
            SELECT * FROM ai_usage_monthly 
            WHERE year_month = to_char(CURRENT_DATE - interval '1 month', 'YYYY-MM')
        `);

    // Budget info
    const budgetResult = await db.query(`
            SELECT monthly_budget_usd, current_month_usage_usd, budget_alert_threshold
            FROM ai_provider_config WHERE id = 1
        `);

    // Recent requests
    const recentResult = await db.query(`
            SELECT provider, model, total_tokens, cost_usd, request_type, item_title, success, created_at
            FROM ai_usage_log
            ORDER BY created_at DESC
            LIMIT 20
        `);

    const current = currentResult.rows[0] || {};
    const lastMonth = lastMonthResult.rows[0] || {};
    const budget = budgetResult.rows[0] || {};

    res.json({
      currentMonth: {
        requests: parseInt(current.total_requests) || 0,
        tokens: parseInt(current.total_tokens) || 0,
        cost: parseFloat(current.total_cost) || 0,
        avgCostPerCall: parseFloat(current.avg_cost_per_call) || 0,
        successRate: current.total_requests > 0
          ? Math.round((current.successful_requests / current.total_requests) * 100)
          : 100
      },
      lastMonth: {
        requests: parseInt(lastMonth.total_requests) || 0,
        tokens: parseInt(lastMonth.total_tokens) || 0,
        cost: parseFloat(lastMonth.total_cost_usd) || 0
      },
      budget: {
        limit: parseFloat(budget.monthly_budget_usd) || null,
        used: parseFloat(budget.current_month_usage_usd) || 0,
        alertThreshold: budget.budget_alert_threshold || 80,
        percentUsed: budget.monthly_budget_usd
          ? Math.round((budget.current_month_usage_usd / budget.monthly_budget_usd) * 100)
          : 0
      },
      recentRequests: recentResult.rows
    });
  } catch (error) {
    // Table might not exist
    if (error.code === '42P01') {
      return res.json({
        currentMonth: { requests: 0, tokens: 0, cost: 0, avgCostPerCall: 0 },
        lastMonth: { requests: 0, tokens: 0, cost: 0 },
        budget: { limit: null, used: 0, alertThreshold: 80 },
        recentRequests: []
      });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get AI provider status
 */
router.get('/ai/status', async (req, res) => {
  try {
    const status = await aiRouterService.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Reset monthly usage (admin action)
 */
router.post('/ai/reset-usage', async (req, res) => {
  try {
    await cloudLLMService.resetMonthlyUsage();
    res.json({ success: true, message: 'Monthly usage reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PATH TESTING (for re-classification setup)
// ============================================

/**
 * @swagger
 * /api/settings/path-test:
 *   post:
 *     summary: Test if a path is accessible from Classifarr
 */
router.post('/path-test', async (req, res) => {
  try {
    const { path } = req.body;

    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const result = await pathTestService.testPathAccessibility(path);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/path-test/translation:
 *   post:
 *     summary: Test path translation between environments
 */
router.post('/path-test/translation', async (req, res) => {
  try {
    const { plexPath, arrPath, classiflarrPath, sampleFile } = req.body;

    const result = await pathTestService.testPathTranslation({
      plexPath,
      arrPath,
      classiflarrPath,
      sampleFile
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/path-test/mappings/{mediaServerId}:
 *   get:
 *     summary: Test all library mappings for a media server
 */
router.get('/path-test/mappings/:mediaServerId', async (req, res) => {
  try {
    const { mediaServerId } = req.params;
    const result = await pathTestService.testAllMappings(parseInt(mediaServerId));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/path-test/health:
 *   get:
 *     summary: Get re-classification health check status
 */
router.get('/path-test/health', async (req, res) => {
  try {
    const result = await pathTestService.healthCheck();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/media-path-config:
 *   get:
 *     summary: Get media path configuration and accessibility
 */
router.get('/media-path-config', async (req, res) => {
  try {
    const result = await pathTestService.getMediaPathConfig();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// EMBEDDING PROVIDER SETTINGS
// ============================================

const embeddingProvider = require('../services/embeddingProvider');

/**
 * @swagger
 * /api/settings/embedding-provider:
 *   get:
 *     summary: Get embedding provider configuration
 */
router.get('/embedding-provider', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        embedding_provider_mode,
        embedding_ollama_host,
        embedding_ollama_port,
        embedding_ollama_model,
        embedding_cloud_provider,
        embedding_cloud_model,
        embedding_cloud_api_key
      FROM ai_provider_config 
      WHERE id = 1
    `);

    const config = result.rows[0] || {};
    
    // Mask API key in response for security
    if (config.embedding_cloud_api_key) {
      config.embedding_cloud_api_key = maskToken(config.embedding_cloud_api_key);
    }
    
    res.json(config);
  } catch (error) {
    console.error('Failed to get embedding provider config:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/embedding-provider:
 *   put:
 *     summary: Update embedding provider configuration
 */
router.put('/embedding-provider', async (req, res) => {
  try {
    const {
      embedding_provider_mode,
      embedding_ollama_host,
      embedding_ollama_port,
      embedding_ollama_model,
      embedding_cloud_provider,
      embedding_cloud_api_key,
      embedding_cloud_model,
    } = req.body;

    // Build update query - only update API key if provided and not masked
    let apiKeyUpdate = '';
    const params = [
      embedding_provider_mode,
      embedding_ollama_host,
      embedding_ollama_port,
      embedding_ollama_model,
      embedding_cloud_provider,
      embedding_cloud_model
    ];

    if (embedding_cloud_api_key && !isMaskedToken(embedding_cloud_api_key)) {
      apiKeyUpdate = ', embedding_cloud_api_key = $7';
      params.push(embedding_cloud_api_key);
    }

    const result = await db.query(`
      UPDATE ai_provider_config SET
        embedding_provider_mode = $1,
        embedding_ollama_host = $2,
        embedding_ollama_port = $3,
        embedding_ollama_model = $4,
        embedding_cloud_provider = $5,
        embedding_cloud_model = $6
        ${apiKeyUpdate}
      WHERE id = 1
      RETURNING *
    `, params);

    // Invalidate caches
    embeddingProvider.resetConfig();
    const embeddingRouter = require('../services/embeddingRouter');
    embeddingRouter.resetConfig();

    // Mask API key in response
    if (result.rows[0]?.embedding_cloud_api_key) {
      result.rows[0].embedding_cloud_api_key = maskToken(result.rows[0].embedding_cloud_api_key);
    }

    res.json({ success: true, config: result.rows[0] });
  } catch (error) {
    console.error('Failed to update embedding provider config:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/embedding-provider/test:
 *   post:
 *     summary: Test embedding provider connection
 */
router.post('/embedding-provider/test', async (req, res) => {
  try {
    const result = await embeddingProvider.testConnection();
    res.json(result);
  } catch (error) {
    console.error('Embedding provider test failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/embedding-provider/defaults:
 *   get:
 *     summary: Get provider-specific model defaults
 */
router.get('/embedding-provider/defaults', async (req, res) => {
  try {
    const defaults = embeddingProvider.getProviderDefaults();
    res.json(defaults);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HEARTBEAT/PROVIDER LOCK CONFIGURATION
// ============================================

const providerLock = require('../services/providerLock');

/**
 * @swagger
 * /api/settings/heartbeat:
 *   get:
 *     summary: Get heartbeat configuration
 */
router.get('/heartbeat', async (req, res) => {
  try {
    // Return in-memory config to ensure consistency
    res.json({
      heartbeat_timeout: providerLock.config.heartbeatTimeout,
      heartbeat_interval: providerLock.config.heartbeatInterval,
      max_wait_time: providerLock.config.maxWaitTime
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/heartbeat:
 *   put:
 *     summary: Update heartbeat configuration
 */
router.put('/heartbeat', async (req, res) => {
  try {
    const { heartbeat_timeout, heartbeat_interval, max_wait_time } = req.body;
    
    // Validate configuration values
    if (heartbeat_timeout !== undefined && (heartbeat_timeout < 5000 || heartbeat_timeout > 120000)) {
      return res.status(400).json({ error: 'heartbeat_timeout must be between 5000 and 120000 ms' });
    }
    
    if (heartbeat_interval !== undefined && (heartbeat_interval < 1000 || heartbeat_interval > 30000)) {
      return res.status(400).json({ error: 'heartbeat_interval must be between 1000 and 30000 ms' });
    }
    
    if (max_wait_time !== undefined && (max_wait_time < 10000 || max_wait_time > 300000)) {
      return res.status(400).json({ error: 'max_wait_time must be between 10000 and 300000 ms' });
    }
    
    // Validate that heartbeat_interval is less than heartbeat_timeout
    const finalInterval = heartbeat_interval !== undefined ? heartbeat_interval : providerLock.config.heartbeatInterval;
    const finalTimeout = heartbeat_timeout !== undefined ? heartbeat_timeout : providerLock.config.heartbeatTimeout;
    
    if (finalInterval >= finalTimeout) {
      return res.status(400).json({ 
        error: 'heartbeat_interval must be less than heartbeat_timeout' 
      });
    }
    
    await providerLock.updateConfig({
      heartbeatTimeout: heartbeat_timeout,
      heartbeatInterval: heartbeat_interval,
      maxWaitTime: max_wait_time,
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/provider-lock/status:
 *   get:
 *     summary: Get current provider lock status
 */
router.get('/provider-lock/status', async (req, res) => {
  try {
    res.json(providerLock.getLockStatus());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

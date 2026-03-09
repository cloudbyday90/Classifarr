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
const embeddingProvider = require('../services/embeddingProvider');
const embeddingRouter = require('../services/embeddingRouter');
const { maskToken, isMaskedToken } = require('../utils/tokenMasking');
const startupService = require('../services/startupService');
const pathTestService = require('../services/pathTestService');
const runtimeSettings = require('../config/runtimeSettings');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { createLogger } = require('../utils/logger');
const {
  getRagLoopDefaultConfig,
  validateAndNormalizeRagLoopConfig,
  validateIssue275PayloadKeys
} = require('../utils/ragLoopConfig');

const router = express.Router();
const logger = createLogger('SettingsRoutes');

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

    await runtimeSettings.refreshFromDatabase();

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

    await runtimeSettings.refreshFromDatabase();

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
    const { host, port, model } = req.body;
    const result = await ollamaService.preflightConnection({
      host,
      port,
      model,
      probeGeneration: false,
      force: true
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/ollama/preflight/last:
 *   get:
 *     summary: Get last scheduled preflight check result
 *     description: Returns the result of the most recent scheduled daily Ollama connection check
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Last preflight check result or null if none has run
 */
router.get('/ollama/preflight/last', async (req, res) => {
  try {
    const result = ollamaService.getLastScheduledPreflight();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/ollama/warm:
 *   post:
 *     summary: Warm (pre-load) a specific model into memory
 *     description: Loads a model into Ollama's memory and keeps it there for the specified duration
 *     tags: [Settings]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               model:
 *                 type: string
 *                 description: Model name to warm (defaults to configured AI model)
 *               keepAlive:
 *                 type: string
 *                 description: Duration to keep model in memory (default 24h)
 *     responses:
 *       200:
 *         description: Model warmed successfully
 */
router.post('/ollama/warm', async (req, res) => {
  try {
    const { model, keepAlive = '24h' } = req.body;
    const result = await ollamaService.warmModel(model, keepAlive);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/ollama/warm-all:
 *   post:
 *     summary: Warm both AI and embedding models into memory
 *     description: Pre-loads both the classification model and embedding model (if different) into Ollama's memory
 *     tags: [Settings]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               keepAlive:
 *                 type: string
 *                 description: Duration to keep models in memory (default 24h)
 *     responses:
 *       200:
 *         description: Models warmed successfully
 */
router.post('/ollama/warm-all', async (req, res) => {
  try {
    const { keepAlive = '24h' } = req.body;
    const result = await ollamaService.warmAllModels(keepAlive);
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
const WEBHOOK_MASK_CHAR = '•';

const isMaskedWebhookSecret = (secret) => {
  if (!secret || typeof secret !== 'string') {
    return false;
  }

  // Accept both standard masked token format and legacy/custom masked variants.
  return isMaskedToken(secret) || secret.includes(WEBHOOK_MASK_CHAR);
};

/**
 * @swagger
 * /api/settings/webhook:
 *   get:
 *     summary: Get webhook configuration (with masked secret key)
 */
router.get('/webhook', async (req, res) => {
  try {
    const config = await webhookService.getConfig();
    const fullSecret = await webhookService.getFullSecret();

    // Mask secret key for security
    if (fullSecret) {
      config.secret_key = maskToken(fullSecret);
    } else if (config.secret_key) {
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
    const config = { ...req.body };

    // Use existing secret key if the provided one is masked
    if (config.secret_key && isMaskedWebhookSecret(config.secret_key)) {
      const fullSecret = await webhookService.getFullSecret();
      if (fullSecret) {
        config.secret_key = fullSecret;
      } else {
        delete config.secret_key;
      }
    }

    const result = await webhookService.updateConfig(config);
    const fullSecret = await webhookService.getFullSecret();

    // Mask secret key in response
    if (fullSecret) {
      result.secret_key = maskToken(fullSecret);
    } else if (result.secret_key) {
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
      secret_key: secretKey,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/webhook/secret:
 *   get:
 *     summary: Reveal the full webhook secret key
 *     description: Returns the full decrypted webhook secret for authenticated admin users
 */
router.get('/webhook/secret', async (req, res) => {
  try {
    const secretKey = await webhookService.getFullSecret();
    
    if (!secretKey) {
      return res.status(404).json({ error: 'No webhook secret configured' });
    }
    
    res.json({ secret_key: secretKey });
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
    const secretKey = await webhookService.getFullSecret();
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    let url = `${baseUrl}/api/webhook/overseerr`;
    if (secretKey) {
      url += `?key=${encodeURIComponent(secretKey)}`;
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
    const secretKey = await webhookService.getFullSecret();
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
    if (secretKey) {
      url += `?key=${encodeURIComponent(secretKey)}`;
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
        rag_text_weight: 0.70,
        rag_image_weight: 0.30,
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
        formula_history_weight: 0.10,
        // Embedding provider configuration
        embedding_provider_mode: 'same',
        embedding_ollama_host: '',
        embedding_ollama_port: 11434,
        embedding_ollama_model: '',
        embedding_cloud_provider: '',
        embedding_cloud_api_key: '',
        embedding_cloud_model: '',
        // Image embedding provider configuration
        image_embedding_provider_mode: 'disabled',
        image_embedding_local_host: '',
        image_embedding_local_port: 8000,
        image_embedding_local_model: '',
        image_embedding_cloud_provider: '',
        image_embedding_cloud_api_key: '',
        image_embedding_cloud_model: '',
        image_embedding_cloud_api_endpoint: '',
        image_embedding_image_size: 512,
        image_embedding_rps: 2,
        image_embedding_concurrency: 2,
        image_embedding_batch_size: 1,
        image_embedding_cache_ttl_hours: 24,
        image_embedding_cache_max_mb: 1024,
        image_embedding_models_cache: null,
        image_embedding_models_cache_updated_at: null,
        // Graph retrieval config (Issue 286)
        rag_graph_enabled: false,
        rag_graph_weight: 0.20,
        rag_graph_collection_enabled: true,
        rag_graph_director_enabled: true,
        rag_graph_studio_enabled: false,
        rag_graph_cast_enabled: false,
        rag_graph_genre_enabled: false,
        rag_graph_min_matches_to_apply: 1,
        rag_graph_candidates_limit: 20,
        ...getRagLoopDefaultConfig()
      });
    }

    const config = result.rows[0];
    const { normalizedConfig } = validateAndNormalizeRagLoopConfig(config, config);
    Object.assign(config, normalizedConfig);
    // Mask API key
    if (config.api_key) {
      config.api_key = maskToken(config.api_key);
    }
    // Mask embedding cloud API key
    if (config.embedding_cloud_api_key) {
      config.embedding_cloud_api_key = maskToken(config.embedding_cloud_api_key);
    }
    // Mask image embedding cloud API key
    if (config.image_embedding_cloud_api_key) {
      config.image_embedding_cloud_api_key = maskToken(config.image_embedding_cloud_api_key);
    }

    res.json(config);
  } catch (error) {
    // Table might not exist
    if (error.code === '42P01') {
      return res.json({
        primary_provider: 'none',
        table_not_ready: true,
        ...getRagLoopDefaultConfig()
      });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update AI provider configuration
 */
router.put('/ai', async (req, res) => {
  const issue275KeyValidation = validateIssue275PayloadKeys(req.body || {});
  if (!issue275KeyValidation.valid) {
    return res.status(400).json({
      error: 'Invalid Issue 275 configuration keys in payload',
      unknown_issue275_keys: issue275KeyValidation.unknownKeys,
      disallowed_v11_keys: issue275KeyValidation.disallowedKeys
    });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

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
      rag_text_weight,
      rag_image_weight,
      rag_min_history_count,
      rag_backfill_budget_type,
      rag_backfill_budget_value,
      // Formula engine weights
      formula_pattern_weight,
      formula_rule_weight,
      formula_rag_weight,
      formula_history_weight,
      // Embedding provider configuration
      embedding_provider_mode,
      embedding_ollama_host,
      embedding_ollama_port,
      embedding_ollama_model,
      embedding_cloud_provider,
      embedding_cloud_api_key,
      embedding_cloud_model,
      // Image embedding provider configuration
      image_embedding_provider_mode,
      image_embedding_local_host,
      image_embedding_local_port,
      image_embedding_local_model,
      image_embedding_cloud_provider,
      image_embedding_cloud_api_key,
      image_embedding_cloud_model,
      image_embedding_cloud_api_endpoint,
      image_embedding_image_size,
      image_embedding_rps,
      image_embedding_concurrency,
      image_embedding_batch_size,
      image_embedding_cache_ttl_hours,
      image_embedding_cache_max_mb,
      // Graph retrieval configuration (Issue 286)
      rag_graph_enabled,
      rag_graph_weight,
      rag_graph_collection_enabled,
      rag_graph_director_enabled,
      rag_graph_studio_enabled,
      rag_graph_cast_enabled,
      rag_graph_genre_enabled,
      rag_graph_min_matches_to_apply,
      rag_graph_candidates_limit
    } = req.body;

    // Fetch existing config to use as fallback for undefined values (partial updates)
    const existingResult = await client.query('SELECT * FROM ai_provider_config WHERE id = 1');
    const existing = existingResult.rows[0] || {};

    const { normalizedConfig: normalizedRagLoopConfig, warnings: ragLoopWarnings } =
      validateAndNormalizeRagLoopConfig(req.body, existing);

    if (ragLoopWarnings.length > 0) {
      logger.warn('Issue 275 config values normalized to safe bounds/defaults', {
        warnings: ragLoopWarnings
      });
    }

    // Handle API key - don't update if masked
    let finalApiKey = api_key;
    if (isMaskedToken(api_key)) {
      finalApiKey = existing.api_key || '';
    } else if (api_key === undefined) {
      finalApiKey = existing.api_key || '';
    }

    // Handle embedding cloud API key - don't update if masked
    let finalEmbeddingCloudApiKey = embedding_cloud_api_key;
    if (isMaskedToken(embedding_cloud_api_key)) {
      finalEmbeddingCloudApiKey = existing.embedding_cloud_api_key || '';
    } else if (embedding_cloud_api_key === undefined) {
      finalEmbeddingCloudApiKey = existing.embedding_cloud_api_key || '';
    }

    // Handle image embedding cloud API key - don't update if masked
    let finalImageEmbeddingCloudApiKey = image_embedding_cloud_api_key;
    if (isMaskedToken(image_embedding_cloud_api_key)) {
      finalImageEmbeddingCloudApiKey = existing.image_embedding_cloud_api_key || '';
    } else if (image_embedding_cloud_api_key === undefined) {
      finalImageEmbeddingCloudApiKey = existing.image_embedding_cloud_api_key || '';
    }

    let normalizedImageEmbeddingMode = image_embedding_provider_mode;
    if (normalizedImageEmbeddingMode !== undefined) {
      if (normalizedImageEmbeddingMode === 'local') {
        normalizedImageEmbeddingMode = 'separate_local';
      }
      if (!['disabled', 'separate_local', 'cloud'].includes(normalizedImageEmbeddingMode)) {
        normalizedImageEmbeddingMode = 'disabled';
      }
    }

    // Check if embedding model changed - if so, clear existing embeddings (dimension incompatibility)
    const modelChanged = (
      (embedding_model && embedding_model !== existing.embedding_model) ||
      (embedding_provider_mode && embedding_provider_mode !== existing.embedding_provider_mode) ||
      (embedding_ollama_model && embedding_ollama_model !== existing.embedding_ollama_model) ||
      (embedding_cloud_model && embedding_cloud_model !== existing.embedding_cloud_model)
    );

    if (modelChanged && existing.embedding_model) {
      // Clear embeddings - dimensions will be incompatible
      try {
        await client.query('DELETE FROM classification_embeddings');
        logger.warn('Embedding model changed - cleared existing embeddings', {
          oldMode: existing.embedding_provider_mode,
          newMode: embedding_provider_mode || existing.embedding_provider_mode,
          oldModel: existing.embedding_model || existing.embedding_ollama_model || existing.embedding_cloud_model,
          newModel: embedding_model || embedding_ollama_model || embedding_cloud_model
        });
      } catch (error) {
        logger.error('Failed to clear embeddings after model change', { error: error.message });
        // Continue anyway - don't fail the config update
      }
    }

    // Validate formula weights sum to approximately 1.0 if any are provided
    const providedWeights = [formula_pattern_weight, formula_rule_weight, formula_rag_weight, formula_history_weight];
    const hasWeights = providedWeights.some(w => w !== undefined);

    if (hasWeights) {
      // Use existing weights from the currently loaded row for partial updates
      const currentWeights = existing || {};

      const finalPatternWeight = formula_pattern_weight ?? currentWeights.formula_pattern_weight ?? 0.40;
      const finalRuleWeight = formula_rule_weight ?? currentWeights.formula_rule_weight ?? 0.30;
      const finalRagWeight = formula_rag_weight ?? currentWeights.formula_rag_weight ?? 0.20;
      const finalHistoryWeight = formula_history_weight ?? currentWeights.formula_history_weight ?? 0.10;

      const sum = finalPatternWeight + finalRuleWeight + finalRagWeight + finalHistoryWeight;

      if (sum < 0.99 || sum > 1.01) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Formula weights must sum to 1.0 (currently ${sum.toFixed(2)}). Adjust the weights so they total 100%.`,
          currentSum: sum
        });
      }
    }

    await client.query(`
            INSERT INTO ai_provider_config (
                id, primary_provider, api_endpoint, api_key, model, temperature, max_tokens,
                monthly_budget_usd, budget_alert_threshold, pause_on_budget_exhausted,
                ollama_fallback_enabled, ollama_for_basic_tasks, ollama_for_budget_exhausted,
                ollama_host, ollama_port, ollama_model,
                rag_enabled, embedding_provider, embedding_model,
                rag_similarity_threshold, rag_text_weight, rag_image_weight, rag_min_history_count,
                rag_backfill_budget_type, rag_backfill_budget_value,
                formula_pattern_weight, formula_rule_weight, formula_rag_weight, formula_history_weight,
                embedding_provider_mode, embedding_ollama_host, embedding_ollama_port, embedding_ollama_model,
                embedding_cloud_provider, embedding_cloud_api_key, embedding_cloud_model,
                image_embedding_provider_mode, image_embedding_local_host, image_embedding_local_port, image_embedding_local_model,
                image_embedding_cloud_provider, image_embedding_cloud_api_key, image_embedding_cloud_model,
                image_embedding_cloud_api_endpoint,
                image_embedding_image_size, image_embedding_rps, image_embedding_concurrency, image_embedding_batch_size,
                image_embedding_cache_ttl_hours, image_embedding_cache_max_mb,
                rag_graph_enabled, rag_graph_weight,
                rag_graph_collection_enabled, rag_graph_director_enabled, rag_graph_studio_enabled,
                rag_graph_cast_enabled, rag_graph_genre_enabled,
                rag_graph_min_matches_to_apply, rag_graph_candidates_limit,
                updated_at
            ) VALUES (
                1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
                $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49,
                $50, $51, $52, $53, $54, $55, $56, $57, $58, NOW()
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
                rag_text_weight = EXCLUDED.rag_text_weight,
                rag_image_weight = EXCLUDED.rag_image_weight,
                rag_min_history_count = EXCLUDED.rag_min_history_count,
                rag_backfill_budget_type = EXCLUDED.rag_backfill_budget_type,
                rag_backfill_budget_value = EXCLUDED.rag_backfill_budget_value,
                formula_pattern_weight = EXCLUDED.formula_pattern_weight,
                formula_rule_weight = EXCLUDED.formula_rule_weight,
                formula_rag_weight = EXCLUDED.formula_rag_weight,
                formula_history_weight = EXCLUDED.formula_history_weight,
                embedding_provider_mode = EXCLUDED.embedding_provider_mode,
                embedding_ollama_host = EXCLUDED.embedding_ollama_host,
                embedding_ollama_port = EXCLUDED.embedding_ollama_port,
                embedding_ollama_model = EXCLUDED.embedding_ollama_model,
                embedding_cloud_provider = EXCLUDED.embedding_cloud_provider,
                embedding_cloud_api_key = EXCLUDED.embedding_cloud_api_key,
                embedding_cloud_model = EXCLUDED.embedding_cloud_model,
                image_embedding_provider_mode = EXCLUDED.image_embedding_provider_mode,
                image_embedding_local_host = EXCLUDED.image_embedding_local_host,
                image_embedding_local_port = EXCLUDED.image_embedding_local_port,
                image_embedding_local_model = EXCLUDED.image_embedding_local_model,
                image_embedding_cloud_provider = EXCLUDED.image_embedding_cloud_provider,
                image_embedding_cloud_api_key = EXCLUDED.image_embedding_cloud_api_key,
                image_embedding_cloud_model = EXCLUDED.image_embedding_cloud_model,
                image_embedding_cloud_api_endpoint = EXCLUDED.image_embedding_cloud_api_endpoint,
                image_embedding_image_size = EXCLUDED.image_embedding_image_size,
                image_embedding_rps = EXCLUDED.image_embedding_rps,
                image_embedding_concurrency = EXCLUDED.image_embedding_concurrency,
                image_embedding_batch_size = EXCLUDED.image_embedding_batch_size,
                image_embedding_cache_ttl_hours = EXCLUDED.image_embedding_cache_ttl_hours,
                image_embedding_cache_max_mb = EXCLUDED.image_embedding_cache_max_mb,
                rag_graph_enabled = EXCLUDED.rag_graph_enabled,
                rag_graph_weight = EXCLUDED.rag_graph_weight,
                rag_graph_collection_enabled = EXCLUDED.rag_graph_collection_enabled,
                rag_graph_director_enabled = EXCLUDED.rag_graph_director_enabled,
                rag_graph_studio_enabled = EXCLUDED.rag_graph_studio_enabled,
                rag_graph_cast_enabled = EXCLUDED.rag_graph_cast_enabled,
                rag_graph_genre_enabled = EXCLUDED.rag_graph_genre_enabled,
                rag_graph_min_matches_to_apply = EXCLUDED.rag_graph_min_matches_to_apply,
                rag_graph_candidates_limit = EXCLUDED.rag_graph_candidates_limit,
                updated_at = NOW()
        `, [
      primary_provider ?? existing.primary_provider ?? 'none',
      api_endpoint ?? existing.api_endpoint ?? '',
      finalApiKey || '',
      model ?? existing.model ?? '',
      temperature ?? existing.temperature ?? 0.7,
      max_tokens ?? existing.max_tokens ?? 2000,
      monthly_budget_usd ?? existing.monthly_budget_usd ?? null,
      budget_alert_threshold ?? existing.budget_alert_threshold ?? 80,
      pause_on_budget_exhausted ?? existing.pause_on_budget_exhausted ?? true,
      ollama_fallback_enabled ?? existing.ollama_fallback_enabled ?? false,
      ollama_for_basic_tasks ?? existing.ollama_for_basic_tasks ?? false,
      ollama_for_budget_exhausted ?? existing.ollama_for_budget_exhausted ?? true,
      ollama_host ?? existing.ollama_host ?? 'localhost',
      ollama_port ?? existing.ollama_port ?? 11434,
      ollama_model ?? existing.ollama_model ?? 'llama3.2',
      rag_enabled ?? existing.rag_enabled ?? false,
      embedding_provider ?? existing.embedding_provider ?? 'auto',
      embedding_model ?? existing.embedding_model ?? '',
      rag_similarity_threshold ?? existing.rag_similarity_threshold ?? 0.70,
      rag_text_weight ?? existing.rag_text_weight ?? 0.70,
      rag_image_weight ?? existing.rag_image_weight ?? 0.30,
      rag_min_history_count ?? existing.rag_min_history_count ?? 50,
      rag_backfill_budget_type ?? existing.rag_backfill_budget_type ?? 'percentage',
      rag_backfill_budget_value ?? existing.rag_backfill_budget_value ?? 25,
      formula_pattern_weight ?? existing.formula_pattern_weight ?? 0.40,
      formula_rule_weight ?? existing.formula_rule_weight ?? 0.30,
      formula_rag_weight ?? existing.formula_rag_weight ?? 0.20,
      formula_history_weight ?? existing.formula_history_weight ?? 0.10,
      embedding_provider_mode ?? existing.embedding_provider_mode ?? 'same',
      embedding_ollama_host ?? existing.embedding_ollama_host ?? '',
      embedding_ollama_port ?? existing.embedding_ollama_port ?? 11434,
      embedding_ollama_model ?? existing.embedding_ollama_model ?? '',
      embedding_cloud_provider ?? existing.embedding_cloud_provider ?? '',
      finalEmbeddingCloudApiKey || '',
      embedding_cloud_model ?? existing.embedding_cloud_model ?? '',
      normalizedImageEmbeddingMode ?? existing.image_embedding_provider_mode ?? 'disabled',
      image_embedding_local_host ?? existing.image_embedding_local_host ?? '',
      image_embedding_local_port ?? existing.image_embedding_local_port ?? 8000,
      image_embedding_local_model ?? existing.image_embedding_local_model ?? '',
      image_embedding_cloud_provider ?? existing.image_embedding_cloud_provider ?? '',
      finalImageEmbeddingCloudApiKey || '',
      image_embedding_cloud_model ?? existing.image_embedding_cloud_model ?? '',
      image_embedding_cloud_api_endpoint ?? existing.image_embedding_cloud_api_endpoint ?? '',
      image_embedding_image_size ?? existing.image_embedding_image_size ?? 512,
      image_embedding_rps ?? existing.image_embedding_rps ?? 2,
      image_embedding_concurrency ?? existing.image_embedding_concurrency ?? 2,
      image_embedding_batch_size ?? existing.image_embedding_batch_size ?? 1,
      image_embedding_cache_ttl_hours ?? existing.image_embedding_cache_ttl_hours ?? 24,
      image_embedding_cache_max_mb ?? existing.image_embedding_cache_max_mb ?? 1024,
      rag_graph_enabled ?? existing.rag_graph_enabled ?? false,
      rag_graph_weight ?? existing.rag_graph_weight ?? 0.20,
      rag_graph_collection_enabled ?? existing.rag_graph_collection_enabled ?? true,
      rag_graph_director_enabled ?? existing.rag_graph_director_enabled ?? true,
      rag_graph_studio_enabled ?? existing.rag_graph_studio_enabled ?? false,
      rag_graph_cast_enabled ?? existing.rag_graph_cast_enabled ?? false,
      rag_graph_genre_enabled ?? existing.rag_graph_genre_enabled ?? false,
      rag_graph_min_matches_to_apply ?? existing.rag_graph_min_matches_to_apply ?? 1,
      rag_graph_candidates_limit ?? existing.rag_graph_candidates_limit ?? 20
    ]);

    const ragLoopKeys = Object.keys(normalizedRagLoopConfig);
    if (ragLoopKeys.length > 0) {
      const ragAssignments = ragLoopKeys
        .map((key, index) => `${key} = $${index + 1}`)
        .join(', ');
      const ragValues = ragLoopKeys.map(key => normalizedRagLoopConfig[key]);

      await client.query(`
        UPDATE ai_provider_config
        SET ${ragAssignments},
            updated_at = NOW()
        WHERE id = 1
      `, ragValues);
    }

    const latestResult = await client.query('SELECT * FROM ai_provider_config WHERE id = 1');
    const config = latestResult.rows[0];
    const localConfigChanged = (
      (existing.image_embedding_local_host || '') !== (config.image_embedding_local_host || '') ||
      Number(existing.image_embedding_local_port || 8000) !== Number(config.image_embedding_local_port || 8000)
    );
    const cloudConfigChanged = (
      (existing.image_embedding_cloud_provider || '') !== (config.image_embedding_cloud_provider || '') ||
      (existing.image_embedding_cloud_api_endpoint || '') !== (config.image_embedding_cloud_api_endpoint || '')
    );

    if (localConfigChanged || cloudConfigChanged) {
      try {
        const currentCache = existing.image_embedding_models_cache || {};
        const nextCache = { ...currentCache };
        if (localConfigChanged) {
          delete nextCache.local;
        }
        if (cloudConfigChanged) {
          delete nextCache.cloud;
        }

        await client.query(`
            UPDATE ai_provider_config
            SET image_embedding_models_cache = $1,
                image_embedding_models_cache_updated_at = NOW()
            WHERE id = 1
          `, [nextCache]);
        config.image_embedding_models_cache = nextCache;
        config.image_embedding_models_cache_updated_at = new Date().toISOString();
      } catch (cacheError) {
        // Best-effort cache reset; do not fail request
      }
    }

    await client.query('COMMIT');

    // Clear config cache after successful commit
    aiRouterService.clearCache();
    ollamaService.resetConfig(); // Clear Ollama config cache to pick up ollama_host/ollama_port changes

    // Invalidate embedding caches
    embeddingProvider.resetConfig();
    embeddingRouter.resetConfig();

    if (config.api_key) {
      config.api_key = maskToken(config.api_key);
    }
    // Mask embedding cloud API key
    if (config.embedding_cloud_api_key) {
      config.embedding_cloud_api_key = maskToken(config.embedding_cloud_api_key);
    }
    // Mask image embedding cloud API key
    if (config.image_embedding_cloud_api_key) {
      config.image_embedding_cloud_api_key = maskToken(config.image_embedding_cloud_api_key);
    }

    res.json(config);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      logger.error('Failed to rollback AI settings update transaction', {
        error: rollbackError.message
      });
    }
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
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
// EMBEDDING PROVIDER SETTINGS (Consolidated)
// ============================================
// Note: Embedding provider configuration endpoints were consolidated into /api/settings/ai
// to eliminate redundancy and provide a unified API for all AI provider settings.
//
// Previously available endpoints (now removed):
//   - GET/PUT /api/settings/embedding-provider -> Use GET/PUT /api/settings/ai
//   - POST /api/settings/embedding-provider/test -> Use POST /api/rag/test
//   - GET /api/settings/embedding-provider/defaults -> Unused, removed
//
// The /api/settings/ai endpoint now handles all embedding provider fields:
//   - embedding_provider_mode (same/separate_ollama/cloud)
//   - embedding_ollama_host, embedding_ollama_port, embedding_ollama_model
//   - embedding_cloud_provider, embedding_cloud_api_key, embedding_cloud_model
//   - image_embedding_provider_mode (separate_local/cloud/disabled)
//   - image_embedding_local_host, image_embedding_local_port, image_embedding_local_model
//   - image_embedding_cloud_provider, image_embedding_cloud_api_key, image_embedding_cloud_model
// ============================================

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

// ============================================
// UNIFIED CONFIDENCE SETTINGS (Issue #241)
// ============================================

/**
 * GET /api/settings/confidence
 * Get all confidence-related settings
 * Requires authentication
 */
router.get('/confidence', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT setting_key, setting_value, description, default_value
      FROM confidence_settings
      ORDER BY setting_key
    `);
    
    const settings = result.rows.reduce((acc, row) => {
      acc[row.setting_key] = {
        value: row.setting_value,
        description: row.description,
        default: row.default_value
      };
      return acc;
    }, {});
    
    res.json(settings);
  } catch (error) {
    logger.error('Failed to get confidence settings', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

/**
 * PUT /api/settings/confidence
 * Update confidence settings (admin only)
 */
router.put('/confidence', authenticateToken, requireAdmin, async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const updates = req.body;
    const userId = req.user?.id || null;
    const changeReason = req.body._reason || 'Manual update';
    
    // Warn if client sends deprecated Discord thresholds
    const deprecatedKeys = ['discord_auto_route_threshold', 'discord_verify_threshold', 'discord_enhanced_details_threshold'];
    const sentDeprecatedKeys = deprecatedKeys.filter(key => key in updates);
    if (sentDeprecatedKeys.length > 0) {
      logger.warn('Deprecated Discord threshold settings sent - these are ignored', {
        deprecatedKeys: sentDeprecatedKeys,
        userId
      });
    }
    
    // Validate that settings exist before updating
    const existingKeys = await client.query(
      'SELECT setting_key FROM confidence_settings'
    );
    const validKeys = new Set(existingKeys.rows.map(row => row.setting_key));
    
    for (const [key, newValue] of Object.entries(updates)) {
      if (key.startsWith('_')) continue; // Skip metadata
      
      // Skip deprecated Discord threshold keys (log warning above)
      if (deprecatedKeys.includes(key)) continue;
      
      // Validate key exists
      if (!validKeys.has(key)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Unknown confidence setting key: ${key}` });
      }
      
      // Validate value type
      if (newValue === null || newValue === undefined) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Invalid value for setting: ${key}` });
      }
      
      // Get current value for audit (with row lock to prevent race conditions)
      const current = await client.query(
        'SELECT setting_value FROM confidence_settings WHERE setting_key = $1 FOR UPDATE',
        [key]
      );
      
      const oldValue = current.rows[0]?.setting_value;
      
      // Update setting
      const updateResult = await client.query(`
        UPDATE confidence_settings
        SET setting_value = $1, updated_at = NOW()
        WHERE setting_key = $2
      `, [newValue.toString(), key]);
      
      if (updateResult.rowCount === 0) {
        throw new Error(`Failed to update setting: ${key}`);
      }
      
      // Audit log
      await client.query(`
        INSERT INTO confidence_settings_audit
        (setting_key, old_value, new_value, changed_by, change_reason, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [key, oldValue, newValue.toString(), userId, changeReason, req.ip]);
    }
    
    await client.query('COMMIT');
    
    // Clear cache in autoLearningService
    try {
      const autoLearningService = require('../services/autoLearningService');
      if (autoLearningService.clearCache) {
        autoLearningService.clearCache();
      }
    } catch (err) {
      logger.warn('Could not clear autoLearningService cache', { error: err.message });
    }
    
    logger.info('Confidence settings updated', {
      userId,
      changesCount: Object.keys(updates).filter(k => !k.startsWith('_')).length
    });
    
    res.json({ success: true, message: 'Settings updated successfully' });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to update confidence settings', { 
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    res.status(500).json({ error: 'Failed to update settings' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/settings/confidence/history
 * Get change history for audit (admin only)
 */
router.get('/confidence/history', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const rawLimit = req.query.limit;
    const rawOffset = req.query.offset;

    const limit = rawLimit === undefined ? 50 : parseInt(rawLimit, 10);
    const offset = rawOffset === undefined ? 0 : parseInt(rawOffset, 10);

    const MAX_LIMIT = 1000;

    if (
      !Number.isInteger(limit) ||
      !Number.isInteger(offset) ||
      limit <= 0 ||
      limit > MAX_LIMIT ||
      offset < 0
    ) {
      return res.status(400).json({
        error: `Invalid pagination parameters. 'limit' must be a positive integer up to ${MAX_LIMIT}, and 'offset' must be a non-negative integer.`
      });
    }
    
    const result = await db.query(`
      SELECT 
        csa.*,
        u.username as changed_by_username
      FROM confidence_settings_audit csa
      LEFT JOIN users u ON csa.changed_by = u.id
      ORDER BY csa.changed_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    res.json(result.rows);
  } catch (error) {
    logger.error('Failed to retrieve confidence settings history', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve history' });
  }
});

/**
 * POST /api/settings/confidence/revert/:auditId
 * Revert to a previous setting value (admin only)
 */
router.post('/confidence/revert/:auditId', authenticateToken, requireAdmin, async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { auditId } = req.params;
    const userId = req.user?.id || null;
    
    // Get the audit entry
    const auditResult = await client.query(
      'SELECT * FROM confidence_settings_audit WHERE id = $1',
      [auditId]
    );
    
    if (auditResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Audit entry not found' });
    }
    
    const audit = auditResult.rows[0];
    
    // Revert to old value
    await client.query(`
      UPDATE confidence_settings
      SET setting_value = $1, updated_at = NOW()
      WHERE setting_key = $2
    `, [audit.old_value, audit.setting_key]);
    
    // Log the revert action
    await client.query(`
      INSERT INTO confidence_settings_audit
      (setting_key, old_value, new_value, changed_by, change_reason, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      audit.setting_key,
      audit.new_value,
      audit.old_value,
      userId,
      `Reverted from audit entry ${auditId}`,
      req.ip
    ]);
    
    await client.query('COMMIT');
    
    logger.info('Setting reverted successfully', {
      auditId,
      settingKey: audit.setting_key,
      userId
    });
    
    res.json({ success: true, message: 'Setting reverted successfully' });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to revert setting', { 
      error: error.message,
      stack: error.stack,
      auditId: req.params.auditId,
      userId: req.user?.id
    });
    res.status(500).json({ error: 'Failed to revert setting' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/settings/confidence/export
 * Export all settings as JSON (admin only)
 */
router.post('/confidence/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM confidence_settings');
    
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: req.user?.username || 'unknown',
      settings: result.rows
    };
    
    res.json(exportData);
  } catch (error) {
    logger.error('Failed to export settings', { 
      error: error.message,
      userId: req.user?.id
    });
    res.status(500).json({ error: 'Failed to export settings' });
  }
});

/**
 * POST /api/settings/confidence/import
 * Import settings from JSON (admin only)
 */
router.post('/confidence/import', authenticateToken, requireAdmin, async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { settings } = req.body;
    const userId = req.user?.id || null;
    
    // Validate input
    if (!Array.isArray(settings)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Settings must be an array' });
    }
    
    // Get valid setting keys
    const existingKeys = await client.query(
      'SELECT setting_key FROM confidence_settings'
    );
    const validKeys = new Set(existingKeys.rows.map(row => row.setting_key));
    
    // Validate all settings before importing
    for (const setting of settings) {
      if (!setting.setting_key || !validKeys.has(setting.setting_key)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `Invalid or unknown setting key: ${setting.setting_key}` 
        });
      }
      
      if (setting.setting_value === null || setting.setting_value === undefined) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `Invalid value for setting: ${setting.setting_key}` 
        });
      }
    }
    
    for (const setting of settings) {
      // Get current value for audit
      const current = await client.query(
        'SELECT setting_value FROM confidence_settings WHERE setting_key = $1',
        [setting.setting_key]
      );
      
      const oldValue = current.rows[0]?.setting_value;
      
      // Update setting
      await client.query(`
        UPDATE confidence_settings
        SET setting_value = $1, updated_at = NOW()
        WHERE setting_key = $2
      `, [setting.setting_value, setting.setting_key]);
      
      // Audit log
      await client.query(`
        INSERT INTO confidence_settings_audit
        (setting_key, old_value, new_value, changed_by, change_reason, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        setting.setting_key,
        oldValue,
        setting.setting_value,
        userId,
        'Imported from configuration file',
        req.ip
      ]);
    }
    
    await client.query('COMMIT');
    
    logger.info('Settings imported successfully', {
      userId,
      settingsCount: settings.length
    });
    
    res.json({ success: true, message: 'Settings imported successfully' });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to import confidence settings', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      ip: req.ip
    });
    res.status(500).json({ error: 'Failed to import settings' });
  } finally {
    client.release();
  }
});

module.exports = router;

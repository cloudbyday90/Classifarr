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

const router = express.Router();

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
    const { name, url, api_key, protocol, host, port, base_path, verify_ssl, timeout } = req.body;

    const result = await db.query(
      `INSERT INTO radarr_config (name, url, api_key, protocol, host, port, base_path, verify_ssl, timeout)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [name, url, api_key, protocol || 'http', host || 'localhost', port || 7878, base_path || '', verify_ssl !== false, timeout || 30]
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
    const { name, url, api_key, protocol, host, port, base_path, verify_ssl, timeout, is_active } = req.body;

    // Get existing config to preserve API key if masked value is sent
    const existingResult = await db.query('SELECT api_key FROM radarr_config WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Radarr configuration not found' });
    }
    const existingApiKey = existingResult.rows[0].api_key;
    
    // Use existing API key if the provided one is masked
    const finalApiKey = (api_key && !isMaskedToken(api_key)) ? api_key : existingApiKey;

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
           updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [name, url, finalApiKey, protocol, host, port, base_path, verify_ssl, timeout, is_active, id]
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
    const { name, url, api_key, protocol, host, port, base_path, verify_ssl, timeout } = req.body;

    const result = await db.query(
      `INSERT INTO sonarr_config (name, url, api_key, protocol, host, port, base_path, verify_ssl, timeout)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [name, url, api_key, protocol || 'http', host || 'localhost', port || 8989, base_path || '', verify_ssl !== false, timeout || 30]
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
    const { name, url, api_key, protocol, host, port, base_path, verify_ssl, timeout, is_active } = req.body;

    // Get existing config to preserve API key if masked value is sent
    const existingResult = await db.query('SELECT api_key FROM sonarr_config WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sonarr configuration not found' });
    }
    const existingApiKey = existingResult.rows[0].api_key;
    
    // Use existing API key if the provided one is masked
    const finalApiKey = (api_key && !isMaskedToken(api_key)) ? api_key : existingApiKey;

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
           updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [name, url, finalApiKey, protocol, host, port, base_path, verify_ssl, timeout, is_active, id]
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
  try {
    const { host, port, model, temperature } = req.body;

    // Deactivate existing configs
    await db.query('UPDATE ollama_config SET is_active = false');

    // Insert or update
    const result = await db.query(
      `INSERT INTO ollama_config (host, port, model, temperature, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [host, port, model, temperature]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
  try {
    const { api_key, language } = req.body;

    // Deactivate existing configs
    await db.query('UPDATE tmdb_config SET is_active = false');

    // Insert or update
    const result = await db.query(
      `INSERT INTO tmdb_config (api_key, language, is_active)
       VALUES ($1, $2, true)
       RETURNING *`,
      [api_key, language || 'en-US']
    );

    // Mask the API key in response
    if (result.rows && result.rows.length > 0 && result.rows[0]) {
      result.rows[0].api_key = maskToken(result.rows[0].api_key);
    }

    res.json(result.rows && result.rows.length > 0 ? result.rows[0] : null);
  } catch (error) {
    res.status(500).json({ error: error.message });
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

    // Get existing config to preserve bot token if masked value is sent
    const existingResult = await db.query('SELECT bot_token FROM notification_config WHERE type = $1 LIMIT 1', ['discord']);
    const existingToken = existingResult.rows[0]?.bot_token;
    
    // Use existing token if the provided one is masked
    const finalToken = (bot_token && !isMaskedToken(bot_token)) ? bot_token : existingToken;

    const result = await db.query(
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
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/discord/test:
 *   post:
 *     summary: Test Discord bot connection
 */
router.post('/discord/test', async (req, res) => {
  try {
    const { bot_token } = req.body;
    const result = await discordBotService.testConnection(bot_token);
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
    const servers = await discordBotService.getServers(bot_token);
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
    const channels = await discordBotService.getChannels(serverId, bot_token);
    res.json(channels);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
        search_depth || 'basic',
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
      searchDepth: config.search_depth || 'basic',
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

module.exports = router;

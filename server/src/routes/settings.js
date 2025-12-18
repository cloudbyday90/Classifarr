const express = require('express');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const db = require('../config/database');
const radarrService = require('../services/radarr');
const sonarrService = require('../services/sonarr');
const ollamaService = require('../services/ollama');
const tmdbService = require('../services/tmdb');
const discordBotService = require('../services/discordBot');
const tavilyService = require('../services/tavily');
const { maskToken, isMaskedToken } = require('../utils/tokenMasking');

const router = express.Router();

// Rate limiter for SSL test endpoint (file system access)
const sslTestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 tests per window
  message: { error: 'Too many SSL test requests, please try again later' },
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
 *     summary: Get all Radarr configurations
 */
router.get('/radarr', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM radarr_config ORDER BY id');
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
    const { name, url, api_key } = req.body;

    const result = await db.query(
      `INSERT INTO radarr_config (name, url, api_key)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, url, api_key]
    );

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
    const { name, url, api_key, is_active } = req.body;

    const result = await db.query(
      `UPDATE radarr_config
       SET name = COALESCE($1, name),
           url = COALESCE($2, url),
           api_key = COALESCE($3, api_key),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [name, url, api_key, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Radarr configuration not found' });
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
 *     summary: Test Radarr connection
 */
router.post('/radarr/test', async (req, res) => {
  try {
    const { url, api_key } = req.body;
    const result = await radarrService.testConnection(url, api_key);
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
 *     summary: Get all Sonarr configurations
 */
router.get('/sonarr', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM sonarr_config ORDER BY id');
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
    const { name, url, api_key } = req.body;

    const result = await db.query(
      `INSERT INTO sonarr_config (name, url, api_key)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, url, api_key]
    );

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
    const { name, url, api_key, is_active } = req.body;

    const result = await db.query(
      `UPDATE sonarr_config
       SET name = COALESCE($1, name),
           url = COALESCE($2, url),
           api_key = COALESCE($3, api_key),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [name, url, api_key, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sonarr configuration not found' });
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
 *     summary: Test Sonarr connection
 */
router.post('/sonarr/test', async (req, res) => {
  try {
    const { url, api_key } = req.body;
    const result = await sonarrService.testConnection(url, api_key);
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

/**
 * @swagger
 * /api/settings/webhook:
 *   get:
 *     summary: Get webhook configuration
 */
router.get('/webhook', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM webhook_config WHERE is_active = true LIMIT 1');
    if (result.rows[0] && result.rows[0].api_key) {
      // Mask API key for security
      result.rows[0].api_key = maskToken(result.rows[0].api_key);
    }
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/webhook/generate-key:
 *   post:
 *     summary: Generate new webhook API key
 */
router.post('/webhook/generate-key', async (req, res) => {
  try {
    const { name } = req.body;
    
    // Generate a secure random API key
    const apiKey = crypto.randomBytes(32).toString('hex');
    
    // Deactivate existing webhooks
    await db.query('UPDATE webhook_config SET is_active = false');
    
    // Create new webhook config
    const result = await db.query(
      `INSERT INTO webhook_config (name, api_key, is_active)
       VALUES ($1, $2, true)
       RETURNING *`,
      [name || 'Default Webhook', apiKey]
    );

    res.json({
      ...result.rows[0],
      api_key: apiKey, // Return full key on generation
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/webhook/logs:
 *   get:
 *     summary: Get recent webhook activity logs
 */
router.get('/webhook/logs', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const result = await db.query(
      `SELECT wl.*, wc.name as webhook_name
       FROM webhook_log wl
       LEFT JOIN webhook_config wc ON wl.webhook_id = wc.id
       ORDER BY wl.created_at DESC
       LIMIT $1`,
      [parseInt(limit)]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    // Check if TMDB is configured (required)
    const tmdbResult = await db.query('SELECT id FROM tmdb_config WHERE is_active = true LIMIT 1');
    const tmdbConfigured = tmdbResult.rows.length > 0;

    // Check if Ollama is configured (optional)
    const ollamaResult = await db.query('SELECT id FROM ollama_config WHERE is_active = true LIMIT 1');
    const ollamaConfigured = ollamaResult.rows.length > 0;

    // Check if Discord is configured (optional)
    const discordResult = await db.query('SELECT id FROM notification_config WHERE type = $1 AND enabled = true LIMIT 1', ['discord']);
    const discordConfigured = discordResult.rows.length > 0;

    const setupComplete = tmdbConfigured;

    res.json({
      setupComplete,
      tmdbConfigured,
      ollamaConfigured,
      discordConfigured,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SSL/TLS CONFIGURATION
// ============================================

/**
 * @swagger
 * /api/settings/ssl:
 *   get:
 *     summary: Get SSL configuration
 */
router.get('/ssl', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM ssl_config LIMIT 1');
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/ssl:
 *   put:
 *     summary: Update SSL configuration
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
      `UPDATE ssl_config
       SET enabled = COALESCE($1, enabled),
           cert_path = COALESCE($2, cert_path),
           key_path = COALESCE($3, key_path),
           ca_path = COALESCE($4, ca_path),
           force_https = COALESCE($5, force_https),
           hsts_enabled = COALESCE($6, hsts_enabled),
           hsts_max_age = COALESCE($7, hsts_max_age),
           client_cert_required = COALESCE($8, client_cert_required),
           updated_at = NOW()
       WHERE id = 1
       RETURNING *`,
      [enabled, cert_path, key_path, ca_path, force_https, hsts_enabled, hsts_max_age, client_cert_required]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'SSL configuration not found' });
    }

    res.json({
      ...result.rows[0],
      message: 'SSL configuration updated. Server restart required for changes to take effect.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/ssl/test:
 *   post:
 *     summary: Test SSL certificate validity
 */
router.post('/ssl/test', sslTestLimiter, async (req, res) => {
  try {
    const fs = require('fs');
    const { cert_path, key_path } = req.body;

    if (!cert_path || !key_path) {
      return res.status(400).json({ error: 'Certificate and key paths are required' });
    }

    // Check if files exist
    if (!fs.existsSync(cert_path)) {
      return res.status(400).json({ error: 'Certificate file not found', path: cert_path });
    }

    if (!fs.existsSync(key_path)) {
      return res.status(400).json({ error: 'Key file not found', path: key_path });
    }

    // Try to read certificate info
    try {
      const https = require('https');
      const tls = require('tls');
      
      const cert = fs.readFileSync(cert_path, 'utf8');
      const key = fs.readFileSync(key_path, 'utf8');

      // Create a test context to validate - wrap in try-catch to prevent info disclosure
      try {
        const context = tls.createSecureContext({ cert, key });
      } catch (contextError) {
        // Sanitize error to prevent certificate details disclosure
        return res.status(400).json({
          valid: false,
          error: 'Certificate and key do not match or are invalid'
        });
      }

      res.json({
        valid: true,
        message: 'SSL certificate and key are valid',
        cert_path,
        key_path
      });
    } catch (error) {
      // Sanitize file read errors
      res.status(400).json({
        valid: false,
        error: 'Unable to read certificate or key files'
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

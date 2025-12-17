const express = require('express');
const db = require('../config/database');
const radarrService = require('../services/radarr');
const sonarrService = require('../services/sonarr');
const ollamaService = require('../services/ollama');
const clarificationService = require('../services/clarification');

const router = express.Router();

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
    const result = await ollamaService.testConnection();
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
    const models = await ollamaService.getModels();
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

    res.json(result.rows[0]);
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
    const result = await db.query('SELECT * FROM notification_config LIMIT 1');
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
    const { bot_token, channel_id, enabled } = req.body;

    const result = await db.query(
      `INSERT INTO notification_config (id, type, bot_token, channel_id, enabled)
       VALUES (1, 'discord', $1, $2, $3)
       ON CONFLICT (id) DO UPDATE 
       SET bot_token = $1, channel_id = $2, enabled = $3, updated_at = NOW()
       RETURNING *`,
      [bot_token, channel_id, enabled !== false]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CONFIDENCE THRESHOLDS CONFIGURATION
// ============================================

/**
 * @swagger
 * /api/settings/confidence:
 *   get:
 *     summary: Get confidence thresholds
 */
router.get('/confidence', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM confidence_thresholds ORDER BY min_confidence DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/confidence:
 *   put:
 *     summary: Update confidence thresholds
 */
router.put('/confidence', async (req, res) => {
  try {
    const thresholds = req.body; // Array of threshold objects

    for (const threshold of thresholds) {
      await db.query(
        `UPDATE confidence_thresholds 
         SET min_confidence = $1, 
             max_confidence = $2, 
             notify_discord = $3, 
             enabled = $4,
             updated_at = NOW()
         WHERE action_type = $5`,
        [
          threshold.min_confidence,
          threshold.max_confidence,
          threshold.notify_discord !== false,
          threshold.enabled !== false,
          threshold.action_type
        ]
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CLARIFICATION QUESTIONS CONFIGURATION
// ============================================

/**
 * @swagger
 * /api/settings/clarification-questions:
 *   get:
 *     summary: Get all clarification questions
 */
router.get('/clarification-questions', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM clarification_questions ORDER BY question_type, priority DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/settings/clarification-questions/{id}:
 *   put:
 *     summary: Update a clarification question (enable/disable)
 */
router.put('/clarification-questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled, priority } = req.body;

    const result = await db.query(
      `UPDATE clarification_questions
       SET enabled = COALESCE($1, enabled),
           priority = COALESCE($2, priority)
       WHERE id = $3
       RETURNING *`,
      [enabled, priority, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CLARIFICATION DATA & STATS
// ============================================

/**
 * @swagger
 * /api/clarifications/{classificationId}:
 *   get:
 *     summary: Get clarifications for a classification
 */
router.get('/clarifications/:classificationId', async (req, res) => {
  try {
    const { classificationId } = req.params;
    const responses = await clarificationService.getResponsesForClassification(classificationId);
    res.json(responses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/clarifications/stats:
 *   get:
 *     summary: Get clarification statistics
 */
router.get('/clarifications/stats', async (req, res) => {
  try {
    const stats = await clarificationService.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

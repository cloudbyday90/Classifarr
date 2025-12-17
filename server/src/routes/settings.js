const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

/**
 * Get all settings
 */
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM settings ORDER BY category, key');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get setting by key
 */
router.get('/:key', async (req, res) => {
  try {
    const result = await query('SELECT * FROM settings WHERE key = $1', [req.params.key]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update setting
 */
router.put('/:key', async (req, res) => {
  try {
    const { value } = req.body;

    const result = await query(`
      UPDATE settings 
      SET value = $1, updated_at = CURRENT_TIMESTAMP
      WHERE key = $2
      RETURNING *
    `, [value, req.params.key]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get Ollama config
 */
router.get('/ollama/config', async (req, res) => {
  try {
    const result = await query('SELECT * FROM ollama_config WHERE enabled = true LIMIT 1');
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update Ollama config
 */
router.put('/ollama/config', async (req, res) => {
  try {
    const { host, port, model, timeout, enabled } = req.body;

    // Check if config exists
    const checkResult = await query('SELECT id FROM ollama_config LIMIT 1');
    
    let result;
    if (checkResult.rows.length === 0) {
      // Insert new config
      result = await query(`
        INSERT INTO ollama_config (host, port, model, timeout, enabled)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [host, port, model, timeout, enabled !== false]);
    } else {
      // Update existing config
      result = await query(`
        UPDATE ollama_config 
        SET host = COALESCE($1, host),
            port = COALESCE($2, port),
            model = COALESCE($3, model),
            timeout = COALESCE($4, timeout),
            enabled = COALESCE($5, enabled),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING *
      `, [host, port, model, timeout, enabled, checkResult.rows[0].id]);
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get TMDB config
 */
router.get('/tmdb/config', async (req, res) => {
  try {
    const result = await query('SELECT * FROM tmdb_config LIMIT 1');
    // Don't expose API key in response
    if (result.rows[0]) {
      result.rows[0].api_key = result.rows[0].api_key ? '***' : null;
    }
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update TMDB config
 */
router.put('/tmdb/config', async (req, res) => {
  try {
    const { api_key, language, enabled } = req.body;

    // Check if config exists
    const checkResult = await query('SELECT id FROM tmdb_config LIMIT 1');
    
    let result;
    if (checkResult.rows.length === 0) {
      // Insert new config
      result = await query(`
        INSERT INTO tmdb_config (api_key, language, enabled)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [api_key, language, enabled !== false]);
    } else {
      // Update existing config
      result = await query(`
        UPDATE tmdb_config 
        SET api_key = COALESCE($1, api_key),
            language = COALESCE($2, language),
            enabled = COALESCE($3, enabled),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *
      `, [api_key, language, enabled, checkResult.rows[0].id]);
    }

    // Don't expose API key in response
    if (result.rows[0]) {
      result.rows[0].api_key = result.rows[0].api_key ? '***' : null;
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get notification config
 */
router.get('/notifications/config', async (req, res) => {
  try {
    const result = await query('SELECT * FROM notification_config LIMIT 1');
    // Don't expose bot token in response
    if (result.rows[0]) {
      result.rows[0].discord_bot_token = result.rows[0].discord_bot_token ? '***' : null;
    }
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update notification config
 */
router.put('/notifications/config', async (req, res) => {
  try {
    const { discord_bot_token, discord_channel_id, discord_enabled, send_on_classification, send_on_error } = req.body;

    // Check if config exists
    const checkResult = await query('SELECT id FROM notification_config LIMIT 1');
    
    let result;
    if (checkResult.rows.length === 0) {
      // Insert new config
      result = await query(`
        INSERT INTO notification_config (discord_bot_token, discord_channel_id, discord_enabled, send_on_classification, send_on_error)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [discord_bot_token, discord_channel_id, discord_enabled, send_on_classification, send_on_error]);
    } else {
      // Update existing config
      result = await query(`
        UPDATE notification_config 
        SET discord_bot_token = COALESCE($1, discord_bot_token),
            discord_channel_id = COALESCE($2, discord_channel_id),
            discord_enabled = COALESCE($3, discord_enabled),
            send_on_classification = COALESCE($4, send_on_classification),
            send_on_error = COALESCE($5, send_on_error),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING *
      `, [discord_bot_token, discord_channel_id, discord_enabled, send_on_classification, send_on_error, checkResult.rows[0].id]);
    }

    // Don't expose bot token in response
    if (result.rows[0]) {
      result.rows[0].discord_bot_token = result.rows[0].discord_bot_token ? '***' : null;
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

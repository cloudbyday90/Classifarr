const express = require('express');
const router = express.Router();
const { query: dbQuery } = require('../config/database');
const tmdbService = require('../services/tmdb');
const ollamaService = require('../services/ollama');
const discordBot = require('../services/discordBot');
const crypto = require('crypto');

// ============================================
// TMDB Settings
// ============================================
router.get('/tmdb', async (req, res) => {
  try {
    const result = await dbQuery('SELECT * FROM tmdb_config WHERE is_active = true LIMIT 1');
    if (result.rows[0]) {
      // Mask API key
      result.rows[0].api_key = result.rows[0].api_key ? '••••••••' + result.rows[0].api_key.slice(-4) : null;
    }
    res.json(result.rows[0] || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/tmdb', async (req, res) => {
  try {
    const { api_key } = req.body;
    // Upsert config
    await dbQuery(`
      INSERT INTO tmdb_config (api_key, is_active)
      VALUES ($1, true)
      ON CONFLICT (id) DO UPDATE SET api_key = $1, updated_at = NOW()
    `, [api_key]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/tmdb/test', async (req, res) => {
  try {
    const { api_key } = req.body;
    const result = await tmdbService.testConnection(api_key);
    res.json({ success: true, ...result });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// ============================================
// Ollama Settings
// ============================================
router.get('/ollama', async (req, res) => {
  try {
    const result = await dbQuery('SELECT * FROM ollama_config WHERE is_active = true LIMIT 1');
    res.json(result.rows[0] || { host: 'localhost', port: 11434, model: 'qwen3:14b', temperature: 0.30 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ollama', async (req, res) => {
  try {
    const { host, port, model, temperature, max_tokens, timeout } = req.body;
    await dbQuery(`
      INSERT INTO ollama_config (host, port, model, temperature, is_active)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (id) DO UPDATE SET 
        host = $1, port = $2, model = $3, temperature = $4, updated_at = NOW()
    `, [host, port, model, temperature]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/ollama/test', async (req, res) => {
  try {
    const { host, port } = req.body;
    const result = await ollamaService.testConnection(host, port);
    res.json({ success: true, version: result.version });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

router.get('/ollama/models', async (req, res) => {
  try {
    const config = await dbQuery('SELECT host, port FROM ollama_config WHERE is_active = true LIMIT 1');
    if (!config.rows[0]) return res.json({ models: [] });
    
    const models = await ollamaService.getModels(config.rows[0].host, config.rows[0].port);
    res.json({ models });
  } catch (error) {
    res.json({ models: [], error: error.message });
  }
});

// ============================================
// Discord Settings
// ============================================
router.get('/discord', async (req, res) => {
  try {
    const result = await dbQuery(`
      SELECT * FROM notification_config WHERE type = 'discord' LIMIT 1
    `);
    if (result.rows[0]?.bot_token) {
      result.rows[0].bot_token = '••••••••' + result.rows[0].bot_token.slice(-4);
    }
    res.json(result.rows[0] || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/discord', async (req, res) => {
  try {
    const {
      enabled, bot_token, channel_id,
      on_classification, on_correction, notify_on_error, notify_daily_summary,
      show_poster, show_confidence, show_reason, show_correction_buttons,
      quick_correct_count, show_library_dropdown
    } = req.body;
    
    await dbQuery(`
      INSERT INTO notification_config (
        type, enabled, bot_token, channel_id,
        on_classification, on_correction, notify_on_error, notify_daily_summary,
        show_poster, show_confidence, show_reason, show_correction_buttons,
        quick_correct_count, show_library_dropdown
      ) VALUES ('discord', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (type) WHERE type = 'discord' DO UPDATE SET
        enabled = $1, bot_token = $2, channel_id = $3,
        on_classification = $4, on_correction = $5, notify_on_error = $6, notify_daily_summary = $7,
        show_poster = $8, show_confidence = $9, show_reason = $10, show_correction_buttons = $11,
        quick_correct_count = $12, show_library_dropdown = $13, updated_at = NOW()
    `, [enabled, bot_token, channel_id, on_classification, on_correction, notify_on_error, notify_daily_summary,
        show_poster, show_confidence, show_reason, show_correction_buttons, quick_correct_count, show_library_dropdown]);
    
    // Reinitialize Discord bot with new settings
    await discordBot.reinitialize();
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/discord/test', async (req, res) => {
  try {
    const { bot_token } = req.body;
    const result = await discordBot.testConnection(bot_token);
    res.json({ success: true, botName: result.username, botId: result.id });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

router.post('/discord/test-message', async (req, res) => {
  try {
    await discordBot.sendTestMessage();
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

router.get('/discord/servers', async (req, res) => {
  try {
    const servers = await discordBot.getServers();
    res.json({ servers });
  } catch (error) {
    res.json({ servers: [], error: error.message });
  }
});

router.get('/discord/channels/:serverId', async (req, res) => {
  try {
    const channels = await discordBot.getChannels(req.params.serverId);
    res.json({ channels });
  } catch (error) {
    res.json({ channels: [], error: error.message });
  }
});

// ============================================
// Webhook Settings
// ============================================
router.get('/webhook', async (req, res) => {
  try {
    const result = await dbQuery('SELECT * FROM webhook_config LIMIT 1');
    const config = result.rows[0] || {};
    if (config.api_key) {
      config.api_key_masked = '••••••••' + config.api_key.slice(-4);
    }
    // Include webhook URL
    config.webhook_url = `http://${req.headers.host}/api/webhook/overseerr`;
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const { enabled, require_auth, ip_whitelist } = req.body;
    await dbQuery(`
      UPDATE webhook_config SET
        enabled = $1, require_auth = $2, ip_whitelist = $3, updated_at = NOW()
      WHERE id = 1
    `, [enabled, require_auth, ip_whitelist]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/webhook/logs', async (req, res) => {
  try {
    const result = await dbQuery(`
      SELECT * FROM webhook_log ORDER BY created_at DESC LIMIT 50
    `);
    res.json({ logs: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/webhook/logs', async (req, res) => {
  try {
    await dbQuery('DELETE FROM webhook_log');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/webhook/generate-key', async (req, res) => {
  try {
    const apiKey = crypto.randomBytes(32).toString('hex');
    await dbQuery('UPDATE webhook_config SET api_key = $1, updated_at = NOW() WHERE id = 1', [apiKey]);
    res.json({ api_key: apiKey });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Setup Status (for first-run wizard)
// ============================================
router.get('/setup-status', async (req, res) => {
  try {
    const tmdb = await dbQuery('SELECT COUNT(*) as count FROM tmdb_config WHERE is_active = true AND api_key IS NOT NULL');
    const mediaServer = await dbQuery('SELECT COUNT(*) as count FROM media_server WHERE is_active = true');
    const arr = await dbQuery('SELECT COUNT(*) as count FROM radarr_config WHERE is_active = true UNION ALL SELECT COUNT(*) as count FROM sonarr_config WHERE is_active = true');
    
    res.json({
      tmdb: tmdb.rows[0].count > 0,
      mediaServer: mediaServer.rows[0].count > 0,
      arr: arr.rows.some(row => row.count > 0)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const discordBot = require('../services/discordBot');

/**
 * @swagger
 * /api/system/health:
 *   get:
 *     summary: Get system health status
 *     description: Returns health status of all system services
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Health status retrieved successfully
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      database: 'unknown',
      discord_bot: 'unknown',
      ollama_ai: 'unknown',
      radarr: 'unknown',
      sonarr: 'unknown',
      media_server: 'unknown'
    };

    // Check database
    try {
      await db.query('SELECT 1');
      health.database = 'healthy';
    } catch (error) {
      health.database = 'unhealthy';
    }

    // Check Discord bot
    try {
      if (discordBot.client && discordBot.client.isReady()) {
        health.discord_bot = 'healthy';
      } else {
        health.discord_bot = 'unhealthy';
      }
    } catch (error) {
      health.discord_bot = 'unhealthy';
    }

    // Check Ollama AI
    try {
      const settingsResult = await db.query(
        'SELECT ollama_host, ollama_port, ollama_enabled FROM settings LIMIT 1'
      );
      
      if (settingsResult.rows.length > 0 && settingsResult.rows[0].ollama_enabled) {
        const ollamaHost = settingsResult.rows[0].ollama_host || 'host.docker.internal';
        const ollamaPort = settingsResult.rows[0].ollama_port || 11434;
        
        try {
          const axios = require('axios');
          await axios.get(`http://${ollamaHost}:${ollamaPort}/api/tags`, { timeout: 2000 });
          health.ollama_ai = 'healthy';
        } catch (error) {
          health.ollama_ai = 'unhealthy';
        }
      } else {
        health.ollama_ai = 'warning'; // Not configured
      }
    } catch (error) {
      health.ollama_ai = 'unknown';
    }

    // Check Radarr/Sonarr connections
    try {
      const libsResult = await db.query(
        'SELECT arr_type, arr_url, arr_api_key FROM libraries WHERE arr_type IS NOT NULL'
      );
      
      let radarrHealthy = false;
      let sonarrHealthy = false;

      for (const lib of libsResult.rows) {
        if (lib.arr_url && lib.arr_api_key) {
          try {
            const axios = require('axios');
            await axios.get(`${lib.arr_url}/api/v3/system/status`, {
              headers: { 'X-Api-Key': lib.arr_api_key },
              timeout: 2000
            });
            
            if (lib.arr_type === 'radarr') radarrHealthy = true;
            if (lib.arr_type === 'sonarr') sonarrHealthy = true;
          } catch (error) {
            // Connection failed for this instance
          }
        }
      }

      health.radarr = radarrHealthy ? 'healthy' : 'warning';
      health.sonarr = sonarrHealthy ? 'healthy' : 'warning';
    } catch (error) {
      health.radarr = 'unknown';
      health.sonarr = 'unknown';
    }

    // Check Media Server
    try {
      const settingsResult = await db.query(
        'SELECT media_server_type, media_server_url, media_server_api_key FROM settings LIMIT 1'
      );
      
      if (settingsResult.rows.length > 0 && settingsResult.rows[0].media_server_url) {
        const settings = settingsResult.rows[0];
        try {
          const axios = require('axios');
          let endpoint = '';
          
          if (settings.media_server_type === 'plex') {
            endpoint = `${settings.media_server_url}/identity`;
          } else if (settings.media_server_type === 'jellyfin') {
            endpoint = `${settings.media_server_url}/System/Info`;
          } else if (settings.media_server_type === 'emby') {
            endpoint = `${settings.media_server_url}/System/Info`;
          }
          
          await axios.get(endpoint, {
            headers: settings.media_server_api_key ? { 'X-MediaBrowser-Token': settings.media_server_api_key } : {},
            timeout: 2000
          });
          health.media_server = 'healthy';
        } catch (error) {
          health.media_server = 'unhealthy';
        }
      } else {
        health.media_server = 'warning'; // Not configured
      }
    } catch (error) {
      health.media_server = 'unknown';
    }

    res.json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Failed to check system health' });
  }
});

/**
 * @swagger
 * /api/system/status:
 *   get:
 *     summary: Get system status
 *     description: Returns system information including version and uptime
 *     tags: [System]
 *     responses:
 *       200:
 *         description: System status retrieved successfully
 */
router.get('/status', async (req, res) => {
  try {
    const packageJson = require('../../package.json');
    
    res.json({
      version: packageJson.version || '1.0.0',
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal
      }
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to get system status' });
  }
});

/**
 * @swagger
 * /api/system/logs:
 *   get:
 *     summary: Get recent logs
 *     description: Returns recent log entries
 *     tags: [System]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of log entries to return
 *     responses:
 *       200:
 *         description: Logs retrieved successfully
 */
router.get('/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    // For now, return mock logs
    // In a production system, you would read from a log file or logging service
    const logs = [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'System logs endpoint accessed'
      },
      {
        timestamp: new Date(Date.now() - 60000).toISOString(),
        level: 'info',
        message: 'Classification completed successfully'
      },
      {
        timestamp: new Date(Date.now() - 120000).toISOString(),
        level: 'info',
        message: 'Discord notification sent'
      }
    ];

    res.json({ logs: logs.slice(0, limit) });
  } catch (error) {
    console.error('Logs retrieval error:', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

module.exports = router;

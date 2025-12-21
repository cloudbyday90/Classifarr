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
const discordBot = require('../services/discordBot');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/system/health:
 *   get:
 *     summary: Get health status of all services
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Health status of all services
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      database: 'disconnected',
      discordBot: 'disconnected',
      ollama: 'unknown',
      radarr: 'unknown',
      sonarr: 'unknown',
      mediaServer: 'unknown'
    };

    // Check database
    try {
      await db.query('SELECT 1');
      health.database = 'connected';
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    // Check Discord bot
    try {
      if (discordBot.client && discordBot.client.isReady()) {
        health.discordBot = 'connected';
      }
    } catch (error) {
      console.error('Discord bot health check failed:', error);
    }

    // Get service configurations from database
    try {
      // Check Ollama
      const ollama = await db.query('SELECT id FROM ollama_config WHERE is_active = true LIMIT 1');
      if (ollama.rows.length > 0) health.ollama = 'configured';

      // Check Radarr
      const radarr = await db.query('SELECT id FROM radarr_config WHERE is_active = true LIMIT 1');
      if (radarr.rows.length > 0) health.radarr = 'configured';

      // Check Sonarr
      const sonarr = await db.query('SELECT id FROM sonarr_config WHERE is_active = true LIMIT 1');
      if (sonarr.rows.length > 0) health.sonarr = 'configured';

      // Check Media Server
      const mediaServer = await db.query('SELECT id FROM media_server WHERE is_active = true LIMIT 1');
      if (mediaServer.rows.length > 0) health.mediaServer = 'configured';
    } catch (error) {
      console.error('Failed to check service configurations:', error);
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
 *     summary: Get system information
 *     tags: [System]
 *     responses:
 *       200:
 *         description: System information
 */
router.get('/status', async (req, res) => {
  try {
    const uptime = process.uptime();
    const version = process.env.npm_package_version || '1.0.0';

    res.json({
      version,
      uptime: Math.floor(uptime),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
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
 *     summary: Get recent log entries
 *     tags: [System]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of log entries to return (default 100)
 *     responses:
 *       200:
 *         description: Recent log entries
 */
router.get('/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;

    // Get recent classification history as a proxy for logs
    const result = await db.query(
      `SELECT 
        ch.id,
        ch.title,
        ch.media_type,
        l.name as selected_library,
        ch.confidence as confidence_score,
        ch.created_at,
        ch.metadata as details
      FROM classification_history ch
      LEFT JOIN libraries l ON ch.library_id = l.id
      ORDER BY ch.created_at DESC
      LIMIT $1`,
      [limit]
    );

    const logs = result.rows.map(row => ({
      id: row.id,
      timestamp: row.created_at,
      type: 'classification',
      message: `${row.media_type}: ${row.title} → ${row.selected_library || 'Unassigned'} (confidence: ${row.confidence_score}%)`,
      details: row.details
    }));

    res.json({
      logs,
      total: logs.length
    });
  } catch (error) {
    console.error('Logs fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

module.exports = router;
